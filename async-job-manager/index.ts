const isStringNotempty = (str: unknown): str is string => {
  return typeof str === "string" && str.trim() !== "";
};
const isNumber = (num: unknown): num is number => {
  return typeof num === "number" && !isNaN(num);
};

const createInvalidJobResult = (
  reason: string,
  job: Job | null = null,
): InvalidJobResult => {
  return {
    valid: false,
    reason: reason,
    job: job,
  };
};

const validateJob = (rawTask: unknown): ValidationResult => {
  // rawTaskのオブジェクト判定
  if (typeof rawTask !== "object" || rawTask === null)
    return createInvalidJobResult("object型で設定されていない");

  if (!("id" in rawTask) || !isStringNotempty(rawTask.id))
    return createInvalidJobResult("idが未設定");

  const validJob: Job = {
    id: rawTask.id,
    name: "-",
    delay: 1000,
    expectations: "success",
  };

  if ("name" in rawTask) {
    if (isStringNotempty(rawTask.name)) {
      validJob.name = rawTask.name;
    } else {
      return createInvalidJobResult("nameの型が異なる", validJob);
    }
  }

  if ("expectations" in rawTask) {
    const expectations = rawTask.expectations;
    if (typeof expectations !== "string")
      return createInvalidJobResult("expectationsの型が違う", validJob);
    if (expectations !== "success" && expectations !== "failed")
      return createInvalidJobResult(
        "expectationsに success・failed 以外の値が設定されている",
        validJob,
      );
    validJob.expectations = expectations;
  }

  if ("processing_time" in rawTask) {
    if (!isNumber(rawTask.processing_time))
      return createInvalidJobResult("processing_timeの型が違う", validJob);
    let processingTime = rawTask.processing_time;
    if (processingTime < 0)
      return createInvalidJobResult("processing_timeが0未満", validJob);
    processingTime = Math.ceil(processingTime);
    const PROCESS_TIME_THRESHOLD = 10;
    if (processingTime > PROCESS_TIME_THRESHOLD) {
      validJob.delay = PROCESS_TIME_THRESHOLD * 1000;
      validJob.expectations = "failed";
      return {
        valid: true,
        job: validJob,
        reason: "閾値超過",
      };
    } else {
      validJob.delay = processingTime * 1000;
    }
  }

  return {
    valid: true,
    job: validJob,
  };
};

class JobQueue {
  private queue: (() => Promise<void>)[] = [];
  private jobRecords: JobRecord[] = [];
  private registeredIds: Set<string> = new Set();
  private acceptingJobs = true; // 登録中か？
  private activeJobCount: number = 0; // 同時実行数
  private maxConcurrency: number = 3; // 同時実行可能数
  private interval = 1000;

  finishAdding() {
    this.acceptingJobs = false;
  }

  isFinished() {
    return (
      this.acceptingJobs === false &&
      this.queue.length === 0 &&
      this.activeJobCount === 0
    );
  }

  // que への追加
  add(validJobRecord: Job, index: number) {
    if (validJobRecord.expectations === "success") {
      this.enqueueSuccessfulJob(validJobRecord, index);
    } else {
      this.enqueueFailedJob(validJobRecord, index);
    }
    this.registerId(validJobRecord.id);
    this.run();
  }

  // success時の処理
  private enqueueSuccessfulJob = (job: Job, index: number): void => {
    this.queue.push(async () => {
      this.updateStatus("running", index);
      await this.delayResolve(job.delay);
      this.updateStatus("success", index);
    });
  };

  private enqueueFailedJob = (job: Job, index: number): void => {
    this.queue.push(async () => {
      this.updateStatus("running", index);
      await this.delayReject(job.delay).catch(() => {});
      this.updateStatus("failed", index);
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
    // 同時実r行数が上限あるいは、実行対象タスクがない
    if (
      this.activeJobCount === this.maxConcurrency ||
      this.queue.length === 0
    ) {
      return;
    }
    // 繰り上げ
    const job = this.queue.shift();
    if (!job) return;
    this.activeJobCount++;
    job().finally(() => {
      this.activeJobCount--;
      this.run();
    });
  }
  // ================= ステータス ==============================
  taskInit(validateResult: ValidationResult, index: number, status: JobStatus) {
    this.jobRecords[index] = {
      ...validateResult,
      status: status,
    };
  }

  private registerId = (id: string): void => {
    this.registeredIds.add(id);
  };

  // すでに登録済みか？
  isRegisteredId = (id: string): boolean => {
    return this.registeredIds.has(id);
  };

  // ステータスのアップデート
  private updateStatus(status: JobStatus, index: number): void {
    if (this.jobRecords[index]) {
      this.jobRecords[index].status = status;
    }
  }

  showStatus() {
    let elapsedSeconds = 0;
    const timer = setInterval(() => {
      if (elapsedSeconds === 0) {
        console.log("================================");
      }
      console.log(`${elapsedSeconds}秒目`);
      console.log(this.jobRecords);
      elapsedSeconds++;
      if (this.isFinished()) {
        clearInterval(timer);
        console.log("実行完了");
        console.log("================================");
      }
    }, this.interval);
  }
}

const main = () => {
  const jobQueue = new JobQueue();

  jobQueue.showStatus();
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
      id: "001",
      name: "JOB2",
      processing_time: 15,
      expectations: "success",
    },
    {
      id: "001",
      name: "JOB2",
      processing_time: 1,
      expectations: "success",
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
  for (let rawTask of rawTasks) {
    let validateResult: ValidationResult = validateJob(rawTask);
    const jobId = validateResult?.job?.id;
    if (jobId && jobQueue.isRegisteredId(jobId)) {
      validateResult = createInvalidJobResult("id重複", validateResult.job);
    }

    if (validateResult.valid === true) {
      const job: Job = validateResult.job;
      jobQueue.taskInit(validateResult, index, "pending");
      jobQueue.add(job, index);
    } else if (validateResult.valid === false) {
      jobQueue.taskInit(validateResult, index, "failed");
    }
    index++;
  }
  jobQueue.finishAdding();
};

// => "running"

main();

type ValidationResult = ValidJobResult | InvalidJobResult;

type ValidJobResult = {
  valid: true;
  job: Job;
  reason?: string;
};

type InvalidJobResult = {
  valid: false;
  job?: Job | null;
  reason: string;
};

type Job = {
  id: string;
  name: string;
  delay: number;
  expectations: "success" | "failed";
};

type JobRecord = ValidationResult & {
  status: JobStatus;
};

type JobStatus = "pending" | "running" | "success" | "failed";
