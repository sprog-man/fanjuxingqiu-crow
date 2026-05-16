const crypto = require('crypto');

class Room {
  constructor(hostId, hostNickname) {
    this.code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    this.members = [{ id: hostId, nickname: hostNickname, isHost: true }];
    this.gameState = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }
  findMember(socketId) { return this.members.find(m => m.id === socketId); }
  addMember(id, nickname) { this.members.push({ id, nickname, isHost: false }); this.touch(); }
  removeMember(id) { this.members = this.members.filter(m => m.id !== id); this.touch(); }
  get host() { return this.members.find(m => m.isHost); }
  touch() { this.lastActivity = Date.now(); }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), 60000);
  }
  createRoom(hostId, hostNickname) {
    const room = new Room(hostId, hostNickname);
    this.rooms.set(room.code, room);
    return room;
  }
  getRoom(code) { return this.rooms.get(code); }
  removeRoom(code) { this.rooms.delete(code); }
  _cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > 600000) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { RoomManager, Room };
