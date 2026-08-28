export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell min-h-dvh px-5 pt-[max(1.5rem,calc(1rem+env(safe-area-inset-top)))] pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))] sm:px-8 lg:px-12">
      <div className="mx-auto min-h-[calc(100dvh-max(3rem,calc(2rem+env(safe-area-inset-top)+env(safe-area-inset-bottom)))] w-full max-w-6xl">
        {children}
      </div>
    </div>
  );
}
