import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configProblems, configProblemsHtml } from "@/lib/config/check";
import { publicSupabaseConfig } from "@/lib/config/public";

/**
 * Roda antes de cada página: renova a sessão de login e manda para /login quem não está logado.
 * É só uma checagem rápida — cada página e ação confere de novo o usuário e as permissões.
 * Se as variáveis da Vercel estiverem erradas, mostra uma página explicando o que corrigir.
 */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const problems = configProblems();
  if (problems.length > 0) {
    return new NextResponse(configProblemsHtml(problems), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let response = NextResponse.next({ request });
  const { url, key } = publicSupabaseConfig();

  const supabase = createServerClient(url.value!, key.value!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  let loggedIn = false;
  try {
    const { data } = await supabase.auth.getUser();
    loggedIn = Boolean(data.user);
  } catch (e) {
    console.error("Falha ao consultar o login no Supabase:", e);
  }

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!loggedIn && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
