class ReporterTasks {
  private interval = 1000;
  private tm: TaskManager;
  private tq: TaskQueue;

  constructor(tm: TaskManager, tq: TaskQueue) {
    this.tm = tm;
    this.tq = tq;
  }
  /**
   * interval ごとに、tasksの状況をコンソールに出力する
   */
  report() {
    let m = 0;
    const timer = setInterval(() => {
      if (m === 0) {
        console.log("================================");
      }
      console.log(`${m}秒目`);
      console.log(this.tm.get());
      m++;
      if (this.tq.isFinish()) {
        clearInterval(timer);

        console.log("実行完了");
        console.log(this.tm.getResult());
      }
      console.log("================================");
    }, this.interval);
  }
}
class TaskQueue {
  private queue: (() => Promise<void>)[] = [];
  private acceptingJobs = true; // 登録中か？
  private activeCount: number = 0; // 同時実行数
  private maxConcurrency: number = 3; // 同時実行可能数
  private PROCESSTIME_THRESHOLD: number = 10;
  private tm: TaskManager;

  constructor(tm: TaskManager) {
    this.tm = tm;
  }

  finishAdding() {
    this.acceptingJobs = false;
  }

  isFinish() {
    return (
      this.acceptingJobs === false &&
      this.queue.length === 0 &&
      this.activeCount === 0
    );
  }

  private invalidResult = (
    reason: string,
    job?: validJobType,
  ): ValidationResult => {
    return {
      valid: false,
      reason: reason,
      job: job ? job : null,
    };
  };

  private duplicateId(id: string) {
    const tmTask = this.tm.getById(id);
    console.log(tmTask);
    if (typeof tmTask === "object") {
      return this.invalidResult("重複ID");
    }
  }

  validate(job: unknown): ValidationResult {
    let jobId = "-";
    if (typeof job !== "object" || job === null) {
      return (
        this.duplicateId(jobId) || this.invalidResult("jobがobject型ではない")
      );
    }

    // id が jobに存在するか？
    if (!("id" in job) || typeof job.id !== "string" || job.id.trim() === "") {
      //同一IDがすでにある
      const tmTask = this.tm.getById(jobId);
      console.log(tmTask);
      if (tmTask === undefined) {
        return this.invalidResult("idが設定されていない");
      } else {
        console.log("重複ID");
        return this.invalidResult("重複ID");
      }
    }

    jobId = job.id;
    const validJob: validJobType = {
      id: jobId,
      name: "-",
      processing_time: 1,
      expectations: "success",
    };

    if ("name" in job) {
      if (typeof job.name === "string" && job.name.trim() !== "") {
        validJob.name = job.name;
      }
    }

    if ("expectations" in job) {
      const expectations = job.expectations;
      if (typeof expectations !== "string")
        return this.invalidResult("expectationsの型が違う", validJob);
      if (expectations !== "success" && expectations !== "failed")
        return this.invalidResult(
          "expectationsに success・failed 以外の値が設定されている",
          validJob,
        );
      validJob.expectations = expectations;
    }

    if ("processing_time" in job) {
      if (typeof job.processing_time !== "number" || isNaN(job.processing_time))
        return this.invalidResult("processing_timeの型が違う", validJob);

      let processingTime = job.processing_time;
      if (processingTime < 0)
        return this.invalidResult("processing_timeが0未満", validJob);

      processingTime = Math.ceil(processingTime);
      if (processingTime > this.PROCESSTIME_THRESHOLD) {
        validJob.processing_time = this.PROCESSTIME_THRESHOLD;
        validJob.expectations = "failed";
        return {
          valid: true,
          job: validJob,
          reason: "閾値超過",
        };
      } else {
        validJob.processing_time = processingTime;
      }
    }

    return {
      valid: true,
      job: validJob,
    };
  }
  // que への追加
  add(job: unknown, index: number) {
    const validationResult: ValidationResult = this.validate(job);
    if (validationResult.valid === true) {
      const validTask = validationResult.job;
      this.tm.update("pending", index, validTask, validationResult?.reason);
      const delay: number = validTask.processing_time * 1000;
      if (validTask.expectations === "success") {
        this.enqueueSuccessfulJob(delay, validTask, index);
      } else {
        this.enqueueFailedJob(delay, validTask, index);
      }
      this.run();
    } else if (validationResult.valid === false) {
      this.tm.update(
        "failed",
        index,
        validationResult.job,
        validationResult.reason,
      );
    }
  }

  // success時の処理
  private enqueueSuccessfulJob = (
    delay: number,
    job: validJobType,
    index: number,
  ): void => {
    this.queue.push(async () => {
      this.tm.update("running", index, job);
      await this.delayResolve(delay);
      this.tm.update("success", index, job);
    });
  };

  private enqueueFailedJob = (
    delay: number,
    job: validJobType,
    index: number,
  ): void => {
    this.queue.push(async () => {
      this.tm.update("running", index, job);
      await this.delayReject(delay).catch(() => {});
      this.tm.update("failed", index, job);
    });
  };

  private delayResolve = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  };

  private delayReject = (ms: number): Promise<void> => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${ms}ミリ秒待機後に失敗`));
      }, ms);
    });
  };

  private run() {
    // 同時実行数が上限あるいは、実行対象タスクがない
    if (this.activeCount === this.maxConcurrency || this.queue.length === 0) {
      return;
    }
    // 繰り上げ
    const task = this.queue.shift();
    if (!task) return;
    this.activeCount++;
    task().finally(() => {
      this.activeCount--;
      this.run();
    });
  }
}

class TaskManager {
  private tasks: tasksType = {};
  private results: result[] = [];
  constructor() {}

  get() {
    return this.tasks;
  }
  getById(id: string) {
    return this.tasks[id];
  }

  // タスクステータスの変更
  update(
    status: status,
    index: number,
    job?: validJobType | null,
    reason?: string,
  ) {
    const jobId = job?.id || "-";
    const currentTask = this.tasks[jobId];
    const validName = job?.name || currentTask?.name || "-";
    let validReason = reason || currentTask?.reason || null;
    this.tasks[jobId] = {
      name: validName,
      status: status,
      reason: currentTask?.reason || reason || null,
    };

    if (status === "success" || status === "failed") {
      this.results[index] = {
        id: jobId,
        name: validName,
        status: status,
        reason: validReason,
      };
    }
  }

  getResult() {
    return this.results;
  }
}

// jobsの情報

const main = () => {
  const tm: TaskManager = new TaskManager();
  const taskques = new TaskQueue(tm);
  const reporterTasks = new ReporterTasks(tm, taskques);
  reporterTasks.report();

  // ジョブの取得
  const rawTasks: unknown = [
    "テスト",
    "元気？",
    {
      id: "001",
      name: "JOB1",
      processing_time: 10,
      expectations: "success",
    },
    {
      id: "002",
      name: "JOB2",
      processing_time: 10,
      expectations: "failed",
    },
    {
      id: "003",
      name: "JOB2",
      processing_time: 15,
      expectations: "success",
    },
    {
      id: "004",
      name: "JOB2",
      processing_time: 1,
      expectations: "failed",
    },
    {
      id: "005",
      name: "JOB2",
      processing_time: 1,
      expectations: "failed",
    },
  ];

  if (!Array.isArray(rawTasks)) {
    console.log("jobsの型がArrayではない");
    return;
  }

  let index = 0;
  for (let rowTask of rawTasks) {
    // job がオブジェクトか？
    taskques.add(rowTask, index);
    index++;
  }
  taskques.finishAdding();
};

// => "running"

main();

type ValidationResult =
  | {
      valid: true;
      job: validJobType;
      reason?: string;
    }
  | {
      valid: false;
      job?: validJobType | null;
      reason: string;
    };

type validJobType = {
  id: string;
  name: string;
  processing_time: number;
  expectations: "success" | "failed";
};

type taskType = {
  name: string;
  status: status; // 状態
  reason: string | null;
};

type tasksType = {
  [id: string]: taskType;
};

type status = "pending" | "running" | "success" | "failed";

type result = {
  id: string;
  name: string;
  status: "success" | "failed";
  reason: string | null;
};
