import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="text-4xl">🔎</div>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Ela não existe ou você não tem acesso a ela.</p>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">Voltar para os quadros</Link>
    </main>
  );
}
