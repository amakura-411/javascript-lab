# JavaScript / TypeScript 同期・非同期処理メモ

## 1. 同期処理とは

同期処理は、**上から順番に1つずつ処理する**動きです。

前の処理が終わるまで、次の処理には進みません。

```ts
// ~/javascript-lab/async-job-manager/examples/sync.ts

console.log("A");
console.log("B");
console.log("C");
```

出力：

```text
A
B
C
```

流れ：

```text
Aを実行
  ↓
Aが終わる
  ↓
Bを実行
  ↓
Bが終わる
  ↓
Cを実行
```

---

## 2. 非同期処理とは

非同期処理は、**時間のかかる処理を待っている間も、別の処理を進められる仕組み**です。

JavaScriptでは、次のような処理でよく使います。

- HTTP通信
- ファイル読み書き
- タイマー
- DBアクセス
- ユーザー操作待ち

例：

```ts
// ~/javascript-lab/async-job-manager/examples/async.ts

console.log("A");

setTimeout(() => {
  console.log("B");
}, 1000);

console.log("C");
```

出力：

```text
A
C
B
```

`setTimeout` を呼んだあと、JavaScriptは1秒間その場で止まりません。

```text
A
↓
「1秒後にBを実行して」と登録
↓
C
↓
1秒後
↓
B
```

---

# 3. 同期と非同期の違い

| 項目 | 同期 | 非同期 |
| --- | --- | --- |
| 処理順 | 上から順番 | 完了するタイミングで変わる |
| 待ち時間 | 次の処理も待つ | 別の処理を進められる |
| 例 | 計算、文字列処理 | HTTP、タイマー、ファイル |
| 注意点 | 比較的追いやすい | 実行順を意識する必要がある |

---

# 4. Promiseとは

Promiseは、**「あとで終わる処理」を表すオブジェクト**です。

Promiseには主に3つの状態があります。

| 状態 | 意味 |
| --- | --- |
| pending | まだ処理中 |
| fulfilled | 成功して完了 |
| rejected | 失敗して完了 |

イメージ：

```text
       ┌─ success ─→ fulfilled
pending
       └─ failure ─→ rejected
```

例：

```ts
// ~/javascript-lab/async-job-manager/examples/promise.ts

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
```

この関数は、

```text
delay(1000)
```

とすると、

```text
「1秒後に完了するPromise」
```

を返します。

---

# 5. asyncとは

`async` を付けた関数は、**必ずPromiseを返します**。

```ts
// ~/javascript-lab/async-job-manager/examples/async-function.ts

const hello = async () => {
  return "hello";
};
```

これは考え方として、

```text
Promise<string>
```

を返します。

そのため、

```ts
// ~/javascript-lab/async-job-manager/examples/async-function.ts

hello().then((value) => {
  console.log(value);
});
```

と扱えます。

---

# 6. asyncを付けただけでは中のPromiseを待たない

今回、一番重要だったポイントです。

```ts
// ~/javascript-lab/async-job-manager/examples/no-await.ts

const task = async () => {
  delay(3000);

  console.log("task終了");
};
```

この場合、

```text
delay開始
↓
task終了
↓
3秒後にdelay終了
```

となります。

`async` を付けても、

**中で呼び出したPromiseを自動ですべて待ってくれるわけではありません。**

---

# 7. awaitとは

`await` は、

> このPromiseが終わるまで、このasync関数の続きは進めない

という意味です。

```ts
// ~/javascript-lab/async-job-manager/examples/await.ts

const task = async () => {
  console.log("開始");

  await delay(3000);

  console.log("終了");
};
```

流れ：

```text
task開始
↓
delay開始
↓
awaitで待つ
↓
3秒後
↓
delay完了
↓
task終了
```

ここで大切なのは、

```text
task() のPromise完了
=
task内部の非同期処理も完了
```

になることです。

---

# 8. thenとawaitの違い

どちらもPromiseの完了後に処理できます。

## then

```ts
// ~/javascript-lab/async-job-manager/examples/then.ts

return delay(1000).then(() => {
  console.log("完了");
});
```

## await

```ts
// ~/javascript-lab/async-job-manager/examples/await.ts

await delay(1000);
console.log("完了");
```

今回のような処理では、`await` の方が上から順番に読めるため分かりやすいです。

```text
running
↓
await
↓
success
```

---

# 9. 「Promiseを呼ぶ」と「Promiseを待つ」は違う

この違いは重要です。

## 呼ぶだけ

```ts
// ~/javascript-lab/async-job-manager/examples/call-only.ts

delay(1000);
```

意味：

```text
非同期処理を開始する
ただし完了は待たない
```

## awaitする

```ts
// ~/javascript-lab/async-job-manager/examples/await.ts

await delay(1000);
```

意味：

```text
非同期処理を開始する
完了するまでこの関数の続きは待つ
```

## returnする

```ts
// ~/javascript-lab/async-job-manager/examples/return-promise.ts

return delay(1000);
```

意味：

```text
この関数が返すPromiseとして
delayのPromiseを外側へ渡す
```

---

# 10. 今回のQueueで重要だったこと

Queueでは、次の型を使いました。

```ts
// ~/javascript-lab/async-job-manager/src/index.ts

private queue: (() => Promise<void>)[] = [];
```

これは、

```text
Promise<void>の配列
```

ではなく、

```text
「呼び出すとPromise<void>を返す関数」の配列
```

です。

イメージ：

```text
queue
├─ task1()
├─ task2()
└─ task3()
```

それぞれを呼ぶと、

```text
task()
↓
Promise
↓
ジョブ完了
```

となります。

---

# 11. QueueのPromiseは何を表すべきか

今回の設計では、

> task() が返すPromiseが終わったら、そのジョブも終わっている

という意味にしました。

```text
task開始
↓
running
↓
await 非同期処理
↓
success / failed
↓
taskのPromise完了
```

こうするとQueue側は、

```text
task開始
↓
activeCount + 1
↓
task完了
↓
activeCount - 1
↓
次のtask開始
```

だけを考えればよくなります。

---

# 12. setTimeoutとは

`setTimeout` は、

> 指定時間が経過したあとに、一度だけ処理を実行する

仕組みです。

```ts
// ~/javascript-lab/async-job-manager/examples/set-timeout.ts

setTimeout(() => {
  console.log("3秒後");
}, 3000);
```

今回のジョブ処理では、

```text
ジョブ開始
↓
setTimeout
↓
指定時間経過
↓
ジョブ完了
```

に使いました。

---

# 13. setIntervalとは

`setInterval` は、

> 指定した間隔ごとに繰り返し処理する

仕組みです。

```ts
// ~/javascript-lab/async-job-manager/examples/set-interval.ts

const timer = setInterval(() => {
  console.log("1秒ごと");
}, 1000);
```

停止するときは、

```ts
// ~/javascript-lab/async-job-manager/examples/set-interval.ts

clearInterval(timer);
```

を使います。

---

# 14. setTimeoutとsetIntervalの使い分け

今回の課題では、役割を分けました。

| 処理 | 使用 |
| --- | --- |
| ジョブが何秒後に完了するか | setTimeout |
| 1秒ごとの状態表示 | setInterval |

図：

```text
JobQueue
   │
   ├─ setTimeout
   │     └─ ジョブを完了させる
   │
Reporter
   │
   └─ setInterval
         └─ 現在状態を表示する
```

大切なのは、

**表示処理がジョブの完了判定を担当しない**

ことです。

---

# 15. 同時実行数の管理

今回のQueueでは、同時に最大3件まで実行します。

```text
activeCount = 0

JOB1開始 → 1
JOB2開始 → 2
JOB3開始 → 3

JOB4
→ 上限3なので待機

JOB2終了
→ activeCount = 2
→ JOB4開始
→ activeCount = 3
```

つまり、

```text
Queue
+
activeCount
```

を使って並列数を制御しています。

---

# 16. 全ジョブ終了の判定

今回の終了条件は3つです。

```text
もう追加されない
AND
Queueが空
AND
実行中が0
```

式にすると、

```text
acceptingJobs === false
&& queue.length === 0
&& activeJobCount === 0
```

です。

図：

```text
すべてadd済み
↓
finishAdding()
↓
acceptingJobs = false

さらに

queue = 0
activeJobCount = 0

↓
全ジョブ終了
```

---

# 17. 非同期処理で気をつけること

## 1. 完了順は入力順とは限らない

```text
JOB1: 10秒
JOB2: 1秒
JOB3: 3秒
```

完了順：

```text
JOB2
JOB3
JOB1
```

そのため、結果を入力順で保存したい場合は、

```text
results[index]
```

のように、元の位置を覚えておく必要があります。

---

## 2. asyncだけでは待たない

```ts
// ~/javascript-lab/async-job-manager/examples/wrong.ts

async () => {
  delay(1000);
}
```

これは待ちません。

```ts
// ~/javascript-lab/async-job-manager/examples/correct.ts

async () => {
  await delay(1000);
}
```

なら待ちます。

---

## 3. Promiseの終了と実際の処理終了を合わせる

Queueでは、

```text
Promise終了
=
ジョブ終了
```

にすると管理しやすくなります。

---

# 18. 今回の構成

最終的な考え方は次のようになります。

```text
raw task
   ↓
validateJob()
   ↓
ValidationResult
   ↓
JobQueue
   ├─ queueへ登録
   ├─ 最大3件実行
   ├─ Promise完了を待つ
   └─ status更新
         ↓
      JobRecord[]
         ↓
      状態表示 / 最終結果
```

---

# 19. 同期・非同期を考えるときの確認事項

迷ったら、次の順番で考えます。

1. この処理はすぐ終わるか？
2. 時間がかかる処理か？
3. 完了を待つ必要があるか？
4. 待つなら `await` または `return Promise` が必要か？
5. 完了順が変わっても問題ないか？
6. 同時実行数に制限が必要か？
7. すべて終わったことをどう判断するか？

---

# 20. 最低限覚えること

最初はこの5個だけ覚えておけば十分です。

```text
1. JavaScriptは上から実行する

2. setTimeoutは指定時間後に処理を実行する

3. Promiseは「あとで終わる処理」を表す

4. asyncを付けただけでは、
   中のPromiseを自動で待たない

5. Promiseを待ちたいなら
   await または return が必要
```

特に今回の重要ポイント：

```text
async
≠
中の非同期処理を全部待つ
```

```text
await Promise
=
そのPromiseが完了するまで
async関数の続きを待つ
```

この2つを理解できれば、非同期処理の基礎としては十分です。
