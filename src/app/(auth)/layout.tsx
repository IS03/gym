export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-6 sm:px-6">
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
}
