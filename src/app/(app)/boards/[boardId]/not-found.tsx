import Link from "next/link";

export default function BoardNotFound() {
  return (
    <main className="mx-auto max-w-md space-y-3 p-10 text-center">
      <h1 className="text-xl font-semibold">Quadro não encontrado</h1>
      <p className="text-sm text-muted-foreground">Ele não existe ou você não tem acesso a ele.</p>
      <Link href="/" className="text-sm underline">Voltar para os quadros</Link>
    </main>
  );
}
