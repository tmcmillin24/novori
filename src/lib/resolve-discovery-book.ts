import { createDiscoveryBookResolver } from './discovery-books';
import { resolveGoogleBooksIdentity } from './google-books';
import { searchNovoriBooks } from './book-search';

// Endpoint/field names are compatibility names. The server chooses ISBNdb or
// cached legacy metadata; the client never calls a raw Google Books API here.
export const resolveDiscoveryBook = createDiscoveryBookResolver(resolveGoogleBooksIdentity, searchNovoriBooks);
