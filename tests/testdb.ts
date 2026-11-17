// Import this FIRST in any test that touches the database. It points the app's
// database code at a throwaway test database, and skips the test when none is
// configured, so `npm test` never touches your real data.
//
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
//
// Use a local MongoDB or a separate free Atlas cluster. The tests create and
// DELETE the database called "doclens_test" there.
const uri = process.env.TEST_MONGODB_URI;

if (!uri) {
  console.log("TEST_MONGODB_URI is not set, so the database tests are skipped.");
  process.exit(0);
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB = "doclens_test";
