import { NavLink } from "react-router";
import { LegalDocument, LegalList as List, LegalSection as Section } from "../components/LegalDocument";
import { EXTERNAL_LINKS } from "../constants/links";

// 内容を変えたら更新する
const LAST_UPDATED = "2026年10月25日";

/**
 * 利用規約。Google の OAuth の同意画面に、この URL (/terms) を登録する。
 */
export default function TermsPage() {
  return (
    <LegalDocument title="利用規約" lastUpdated={LAST_UPDATED}>
      <p className="mt-6 leading-relaxed">
        この利用規約 (以下「本規約」) は、ut.code(); (以下「運営者」) が運営する日程調整のサービス「イツヒマ」
        (以下「本サービス」) の利用条件を定めるものです。本サービスを利用した方 (以下「利用者」)
        は、本規約に同意したものとみなします。
      </p>

      <Section title="1. 本サービスについて">
        <p>
          本サービスは、イベントを作り、参加者が参加できる日時を回答することで、日程を調整するための無料のサービスです。ログインしなくても利用でき、Google
          アカウントでログインすると、別の端末からも同じイベントや回答を操作できます。
        </p>
        <p>本サービスはアルファ版として提供しており、機能や仕様は予告なく変わることがあります。</p>
      </Section>

      <Section title="2. 入力する内容">
        <List>
          <li>
            イベントの情報と、回答の名前・コメント・参加できる日時は、そのイベントの URL
            を知っている人なら誰でも見られます。他人に知られて困る情報は入力しないでください。
          </li>
          <li>入力した内容についての責任は、入力した利用者が負います。</li>
          <li>
            イベントと回答の保存期間は、イベントの最終日から 3
            ヶ月です。それを過ぎたイベントと回答は、削除することがあります。
          </li>
        </List>
      </Section>

      <Section title="3. 禁止事項">
        <p>利用者は、本サービスの利用にあたって、次の行為をしてはなりません。</p>
        <List>
          <li>法令または公序良俗に反する行為</li>
          <li>他人の権利や利益を侵害する行為、他人になりすます行為</li>
          <li>他人の個人情報を、本人の同意なく入力する行為</li>
          <li>本サービスのサーバーやネットワークに過度な負荷をかける行為、本サービスの運営を妨げる行為</li>
          <li>本サービスの不具合を意図的に利用する行為、不正にアクセスする行為</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </List>
        <p>
          運営者は、利用者がこれらの行為をしたと判断した場合、事前の通知なく、その利用者が入力した内容を削除し、本サービスの利用を制限することがあります。
        </p>
      </Section>

      <Section title="4. サービスの変更・停止">
        <p>
          運営者は、事前の通知なく、本サービスの内容を変更し、または本サービスの提供を一時的もしくは永続的に停止することがあります。本サービスの提供を終える場合は、できる限り事前に本サービス上でお知らせします。
        </p>
      </Section>

      <Section title="5. 免責">
        <List>
          <li>
            運営者は、本サービスが常に利用できること、不具合がないこと、入力した内容が失われないことを保証しません。
          </li>
          <li>
            運営者は、本サービスの利用または利用できなかったことによって利用者に生じた損害について、運営者の故意または重大な過失による場合を除き、責任を負いません。
          </li>
          <li>利用者同士、または利用者と第三者との間で生じた紛争について、運営者は責任を負いません。</li>
        </List>
      </Section>

      <Section title="6. 個人情報の扱い">
        <p>
          本サービスで取得する情報の扱いは、
          <NavLink to="/privacy" className="link link-primary">
            プライバシーポリシー
          </NavLink>
          に定めます。
        </p>
      </Section>

      <Section title="7. 規約の変更">
        <p>
          運営者は、必要に応じて本規約を変更することがあります。変更した場合は、このページに掲載し、最終更新日を改めます。変更後に本サービスを利用した利用者は、変更後の規約に同意したものとみなします。
        </p>
      </Section>

      <Section title="8. 準拠法">
        <p>本規約は、日本法に準拠します。</p>
      </Section>

      <Section title="9. お問い合わせ">
        <p>
          本規約についてのお問い合わせは、
          <a href={EXTERNAL_LINKS.FEEDBACK} target="_blank" rel="noreferrer noopener" className="link link-primary">
            お問い合わせフォーム
          </a>
          からお願いします。
        </p>
      </Section>
    </LegalDocument>
  );
}
