import Header from "../../../components/Header";

export default function SubmissionDone() {
  return (
    <>
      <Header />
      <div className="container p-4 mx-auto">
        {/* TODO: 作成 / 編集を出し分ける必要なども考えると、別ページでなくていいかもしれない */}
        <p>作成が完了しました</p>
      </div>
    </>
  );
}
