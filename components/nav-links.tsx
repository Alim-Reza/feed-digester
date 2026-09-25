import Link from 'next/link';

export function NavLinks() {
  return (
    <nav className="flex items-center gap-4 text-sm font-medium">
      <Link href="/" className="hover:underline">
        Feed Digester
      </Link>
      <Link href="/digests" className="text-muted-foreground hover:text-foreground hover:underline">
        Digests
      </Link>
      <Link href="/operations" className="text-muted-foreground hover:text-foreground hover:underline">
        Operations
      </Link>
      <Link href="/posts" className="text-muted-foreground hover:text-foreground hover:underline">
        Posts
      </Link>
    </nav>
  );
}
