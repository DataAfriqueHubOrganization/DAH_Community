/** En-têtes de sécurité appliqués à toutes les pages.
 *  La CSP se limite aux directives sans risque de casser l'affichage (pas de
 *  restriction des scripts / images / API) : interdiction d'être affiché dans
 *  une iframe (clickjacking), pas de <base> ni de plugins injectés. */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Pré-production : jamais indexée par les moteurs de recherche.
if (process.env.NEXT_PUBLIC_ENV === "preprod") {
  securityHeaders.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
