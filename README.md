# javascript-lab

JavaScriptの基礎・ブラウザ内部動作・非同期処理・パフォーマンスなどを、実装を通して理解するための学習用リポジトリです。

知識を読むだけではなく、小さな課題ごとに

**要件整理 → 仕様策定 → 実装 → 動作確認 → レビュー → 振り返り**

まで一通り経験することを目的としています。

## Goals

- JavaScriptの動作を「なんとなく」ではなく説明できるようにする
- 実際にコードを書き、挙動を観察して理解する
- ブラウザやJavaScriptランタイムの仕組みを理解する
- 要件から自分で仕様・実装方針を考える
- 実装上の判断理由を説明できるようにする
- 転職時の技術面接で問われる基礎知識を実体験と結びつける

## Topics

主に以下のテーマを扱います。

- JavaScript基礎
- Scope / Closure
- `this`
- Prototype
- Event Loop
- Promise
- `async / await`
- Microtask / Task
- DOM
- Browser API
- Fetch / HTTP
- Error Handling
- Performance
- Memory
- Module
- Testing

課題に必要になったタイミングで、それぞれのテーマを学習します。

## Repository Structure

```text
javascript-lab/
├── README.md
└── event-loop-order/
    ├── README.md
    ├── specification.md
    └── src/
        └── index.js
```

各ディレクトリは、原則として1日以内で完結する独立した課題です。

前の課題を完成させないと次へ進めない構成にはせず、その時に学びたいテーマを自由に選びます。

## Learning Policy

各課題では、最初から完成コードや模範設計を確認せず、与えられた要件から自分で仕様を決めます。

基本的な流れは以下です。

1. 要件を確認する
2. 不足している仕様を自分で決める
3. 実装する
4. 実際の挙動を確認する
5. レビューを受ける
6. 自分で修正する
7. 最後に模範解答と比較する
8. 学んだことを残す

## Completion Policy

各課題では完成を優先します。

以下を満たしたら、その課題は原則として完了とします。

- 要件を満たして動作する
- 自分で決めた仕様を説明できる
- 実装理由をある程度説明できる
- READMEまたは仕様メモが残っている
- レビューを一度受けている

必要以上に機能追加やリファクタリングを続けず、次の課題へ進みます。
