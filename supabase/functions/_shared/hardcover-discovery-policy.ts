import { cleanCatalogBookTitle, isCatalogCollection, isCatalogSupplement } from './book-edition-metadata.ts';
import { isEnglishBookLanguage } from './book-language.ts';
const titleKey = (value: string) => cleanCatalogBookTitle(value).toLowerCase().replace(/[^a-z0-9]/g,'');
export function hardcoverTextEdition(edition: any, title: string, today = new Date().toISOString().slice(0,10)) {
 if (!edition || edition.compilation || Number(edition.audio_seconds) > 0 || edition.reading_format_id === 2) return false;
 const format = `${edition.reading_format?.format ?? ''} ${edition.physical_format ?? ''}`;
 if (/audio|spoken|mp3|cassette/i.test(format) || !/physical|print|paper|hardcover|hardback|ebook|e-book|digital/i.test(format)) return false;
 return [edition.language?.code2,edition.language?.code3,edition.language?.language].some(isEnglishBookLanguage)
  && titleKey(edition.title ?? '') === titleKey(title)
  && (!edition.release_date || String(edition.release_date).slice(0,10) <= today);
}
export function hardcoverDiscoveryEligible(book: any) {
 const product = {volumeInfo:{title:book?.title ?? ''}};
 return !book?.compilation && !isCatalogCollection(product) && !isCatalogSupplement(product) && [book.default_cover_edition,book.default_physical_edition,book.default_ebook_edition,...(book.editions ?? [])]
  .some(edition => hardcoverTextEdition(edition,book.title ?? ''));
}
