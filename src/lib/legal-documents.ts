import content from "../../website/legal-documents.json";

export type LegalDocumentKey = keyof typeof content.documents;
export type LegalSection = {
  title: string;
  paragraphs: string[];
  links?: { label: string; url: string }[];
};
export type LegalDocument = {
  title: string;
  summary: string;
  sections: LegalSection[];
};
export const LEGAL_VERSION = content.version;
export const LEGAL_UPDATED = content.updated;
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> =
  content.documents;
export function getLegalDocument(key: unknown): LegalDocument | null {
  return typeof key === "string" && Object.hasOwn(LEGAL_DOCUMENTS, key)
    ? LEGAL_DOCUMENTS[key as LegalDocumentKey]
    : null;
}
export function acceptedCurrentTerms(
  metadata: Record<string, unknown> | undefined,
) {
  return (
    metadata?.terms_version === LEGAL_VERSION &&
    metadata?.adult_confirmed === true &&
    metadata?.privacy_version === LEGAL_VERSION
  );
}
export function legalAcceptanceMetadata() {
  return {
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
    adult_confirmed: true,
    terms_accepted_at: new Date().toISOString(),
  };
}
