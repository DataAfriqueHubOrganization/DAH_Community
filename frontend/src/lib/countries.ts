// Pays africains en premier (cœur de la communauté DAH), puis le reste du monde
// (diaspora), chaque groupe trié alphabétiquement.
export const AFRICAN_COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso",
  "Burundi", "Cabo Verde", "Cameroun", "Comores", "Congo-Brazzaville",
  "Côte d'Ivoire", "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie",
  "Gabon", "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale",
  "Kenya", "Lesotho", "Liberia", "Libye", "Madagascar", "Malawi", "Mali",
  "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie", "Niger",
  "Nigéria", "Ouganda", "République centrafricaine", "République démocratique du Congo",
  "Rwanda", "Sao Tomé-et-Principe", "Sénégal", "Seychelles", "Sierra Leone",
  "Somalie", "Soudan", "Soudan du Sud", "Tanzanie", "Tchad", "Togo",
  "Tunisie", "Zambie", "Zimbabwe",
] as const;

export const OTHER_COUNTRIES = [
  "Allemagne", "Arabie Saoudite", "Australie", "Belgique", "Brésil", "Canada",
  "Chine", "Corée du Sud", "Émirats Arabes Unis", "Espagne", "États-Unis",
  "France", "Inde", "Italie", "Japon", "Liban", "Pays-Bas", "Portugal",
  "Qatar", "Royaume-Uni", "Suisse", "Turquie", "Autre",
] as const;

export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...OTHER_COUNTRIES];

// Les valeurs envoyées à l'API restent les noms français ci-dessus ;
// seul le libellé affiché change en anglais.
const COUNTRY_EN: Record<string, string> = {
  "Afrique du Sud": "South Africa", "Algérie": "Algeria", "Angola": "Angola", "Bénin": "Benin",
  "Botswana": "Botswana", "Burkina Faso": "Burkina Faso", "Burundi": "Burundi", "Cabo Verde": "Cabo Verde",
  "Cameroun": "Cameroon", "Comores": "Comoros", "Congo-Brazzaville": "Republic of the Congo",
  "Côte d'Ivoire": "Côte d'Ivoire", "Djibouti": "Djibouti", "Égypte": "Egypt", "Érythrée": "Eritrea",
  "Eswatini": "Eswatini", "Éthiopie": "Ethiopia", "Gabon": "Gabon", "Gambie": "Gambia", "Ghana": "Ghana",
  "Guinée": "Guinea", "Guinée-Bissau": "Guinea-Bissau", "Guinée équatoriale": "Equatorial Guinea",
  "Kenya": "Kenya", "Lesotho": "Lesotho", "Liberia": "Liberia", "Libye": "Libya", "Madagascar": "Madagascar",
  "Malawi": "Malawi", "Mali": "Mali", "Maroc": "Morocco", "Maurice": "Mauritius", "Mauritanie": "Mauritania",
  "Mozambique": "Mozambique", "Namibie": "Namibia", "Niger": "Niger", "Nigéria": "Nigeria", "Ouganda": "Uganda",
  "République centrafricaine": "Central African Republic",
  "République démocratique du Congo": "Democratic Republic of the Congo", "Rwanda": "Rwanda",
  "Sao Tomé-et-Principe": "São Tomé and Príncipe", "Sénégal": "Senegal", "Seychelles": "Seychelles",
  "Sierra Leone": "Sierra Leone", "Somalie": "Somalia", "Soudan": "Sudan", "Soudan du Sud": "South Sudan",
  "Tanzanie": "Tanzania", "Tchad": "Chad", "Togo": "Togo", "Tunisie": "Tunisia", "Zambie": "Zambia",
  "Zimbabwe": "Zimbabwe",
  "Allemagne": "Germany", "Arabie Saoudite": "Saudi Arabia", "Australie": "Australia", "Belgique": "Belgium",
  "Brésil": "Brazil", "Canada": "Canada", "Chine": "China", "Corée du Sud": "South Korea",
  "Émirats Arabes Unis": "United Arab Emirates", "Espagne": "Spain", "États-Unis": "United States",
  "France": "France", "Inde": "India", "Italie": "Italy", "Japon": "Japan", "Liban": "Lebanon",
  "Pays-Bas": "Netherlands", "Portugal": "Portugal", "Qatar": "Qatar", "Royaume-Uni": "United Kingdom",
  "Suisse": "Switzerland", "Turquie": "Turkey", "Autre": "Other",
};

export function countryLabel(name: string, locale: "fr" | "en"): string {
  return locale === "en" ? (COUNTRY_EN[name] ?? name) : name;
}

/** Liste triée selon la langue d'affichage ; « Autre » reste en dernier. */
export function sortedCountries(list: readonly string[], locale: "fr" | "en") {
  const items = list.map((value) => ({ value, label: countryLabel(value, locale) }));
  const other = items.filter((c) => c.value === "Autre");
  const rest = items.filter((c) => c.value !== "Autre").sort((a, b) => a.label.localeCompare(b.label, locale));
  return [...rest, ...other];
}
