const { AuditLog } = require('../models');
// Never blocks the request; audit trail is best-effort but always attempted
module.exports = (actor, action, entity, entityId, meta = {}) =>
  AuditLog.create({ actor: actor && actor._id ? actor._id : actor, action, entity, entityId: String(entityId), meta })
    .catch(e => console.error('audit failed:', e.message));
