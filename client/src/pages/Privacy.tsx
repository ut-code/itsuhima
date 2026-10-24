import { LegalDocument, LegalList as List, LegalSection as Section } from "../components/LegalDocument";
import { EXTERNAL_LINKS } from "../constants/links";

// 内容を変えたら更新する
const LAST_UPDATED = "2026年10月25日";

/**
 * プライバシーポリシー。Google の OAuth の同意画面に、この URL (/privacy) を登録する。
 */
export default function PrivacyPage() {
  return (
    <LegalDocument title="プライバシーポリシー" lastUpdated={LAST_UPDATED}>
      <p className="mt-6 leading-relaxed">
        イツヒマ (以下「本サービス」) は、ut.code(); (以下「運営者」)
        が運営する日程調整のサービスです。本サービスで取得する情報と、その扱いを以下に定めます。
      </p>

      <Section title="1. 取得する情報">
        <p>本サービスは、次の情報を取得します。</p>
        <List>
          <li>
            <strong>イベントの情報</strong>:
            イベントの名前・説明・日程・時間帯・参加形態など、イベントを作る人が入力したもの。
          </li>
          <li>
            <strong>回答の情報</strong>: 回答する人が入力した名前・コメント・参加できる日時。
          </li>
          <li>
            <strong>ブラウザの識別子</strong>: ブラウザごとに作るランダムな識別子。Cookie
            に保存し、作ったイベントや回答を、同じブラウザから編集できるようにするために使います。個人を特定する情報は含みません。
          </li>
          <li>
            <strong>Google アカウントの情報</strong> (Google でログインした場合のみ):
            メールアドレス・名前・プロフィール画像、Google がアカウントごとに発行する ID、Google
            から受け取る認証のためのトークン。
          </li>
          <li>
            <strong>ログインのセッションの情報</strong> (Google でログインした場合のみ): ログインした日時、IP
            アドレス、ブラウザの種類 (User-Agent)。
          </li>
        </List>
      </Section>

      <Section title="2. 利用目的">
        <p>取得した情報は、次の目的にだけ使います。</p>
        <List>
          <li>日程調整のサービスを提供するため (イベントと回答を保存し、参加者に表示する)。</li>
          <li>作ったイベントや回答を、本人だけが編集・削除できるようにするため。</li>
          <li>
            Google
            でログインした場合に、別の端末からも同じイベントや回答を操作できるようにするため。メールアドレス・名前・プロフィール画像は、ログイン中のアカウントを本人に示すために使います。
          </li>
          <li>不正な利用を防ぎ、障害に対応するため。</li>
        </List>
        <p>取得した情報を、広告に使うことはありません。</p>
      </Section>

      <Section title="3. 他の利用者に公開される情報">
        <p>
          イベントの情報と、回答の名前・コメント・参加できる日時は、そのイベントの URL
          を知っている人なら誰でも見られます。Google
          アカウントのメールアドレス・名前・プロフィール画像は、他の利用者には表示しません。
        </p>
      </Section>

      <Section title="4. 第三者への提供">
        <p>運営者は、取得した情報を第三者に提供・販売しません。ただし、法令に基づく場合を除きます。</p>
        <p>
          本サービスは Cloudflare, Inc. のサービスの上で動いており、取得した情報はそこに保存されます。ログインには
          Google LLC のサービスを使います。
        </p>
      </Section>

      <Section title="5. 保存期間と削除">
        <List>
          <li>
            イベントと回答の保存期間は、イベントの最終日から 3
            ヶ月です。それを過ぎたイベントと回答は、削除することがあります。イベントを作った人は、それより前にイベントを削除することもできます。
          </li>
          <li>ログインのセッションは、ログアウトするか、最後に使ってから 60 日が経つと無効になります。</li>
          <li>
            Google でログインした人は、アカウントのメニューからアカウントを削除できます。削除すると、Google
            アカウントの情報とセッションの情報を消します。作ったイベントと回答は残り、誰も編集できなくなります。
          </li>
        </List>
      </Section>

      <Section title="6. 改定">
        <p>
          運営者は、必要に応じて本ポリシーを改定することがあります。改定した場合は、このページに掲載し、最終更新日を改めます。
        </p>
      </Section>

      <Section title="7. お問い合わせ">
        <p>
          本ポリシーや情報の扱い (削除の希望を含む) についてのお問い合わせは、
          <a href={EXTERNAL_LINKS.FEEDBACK} target="_blank" rel="noreferrer noopener" className="link link-primary">
            お問い合わせフォーム
          </a>
          からお願いします。
        </p>
      </Section>
    </LegalDocument>
  );
}
