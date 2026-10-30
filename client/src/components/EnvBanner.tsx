/** ラベル (VITE_ENV_LABEL) の付いたビルドで、本番でないことを示す。ページのレイアウトを変えないよう、上端に重ねて出す */
export default function EnvBanner() {
  const label = import.meta.env.VITE_ENV_LABEL;
  if (!label) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center border-[#16a088] border-t-4">
      <span className="rounded-b-md bg-[#16a088] px-2 pb-0.5 font-bold text-[10px] text-white tracking-wider">
        {label}
      </span>
    </div>
  );
}
