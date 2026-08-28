export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell flex min-h-dvh flex-col items-center justify-center px-4 py-[max(1.5rem,calc(1rem+env(safe-area-inset-top)))] pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))] sm:px-6">
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
}
