import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          STOŽER
        </h1>
        <p className="text-lg text-muted-foreground">
          Sports club management platform
        </p>
        <div className="flex gap-4">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium hover:bg-accent"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
