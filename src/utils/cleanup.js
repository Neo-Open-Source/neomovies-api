const { getDb } = require('../db');

// Delete unverified users older than 7 days
async function deleteStaleUsers() {
  try {
    const db = await getDb();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await db.collection('users').deleteMany({ verified: false, createdAt: { $lt: weekAgo } });
    if (result.deletedCount) {
      console.log(`Cleanup: removed ${result.deletedCount} stale unverified users`);
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

// run once at startup and then every 24h
(async () => {
  await deleteStaleUsers();
  setInterval(deleteStaleUsers, 24 * 60 * 60 * 1000);
})();

module.exports = { deleteStaleUsers };
