const crypto = require('crypto');

class Room {
  constructor(hostId, hostNickname, hostAvatar, hostOpenid) {
    this.code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    this.hostOpenid = hostOpenid || '';
    this.members = [{
      id: hostId, nickname: hostNickname, avatar: hostAvatar || '',
      openid: hostOpenid || '', isHost: true, online: true
    }];
    this.gameState = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }
  findMember(socketId) { return this.members.find(m => m.id === socketId); }
  findMemberByOpenid(openid) { return this.members.find(m => m.openid === openid); }
  addMember(id, nickname, avatar, openid) { this.members.push({ id, nickname, avatar: avatar || '', openid: openid || '', isHost: false, online: true }); this.touch(); }
  removeMember(id) { this.members = this.members.filter(m => m.id !== id); this.touch(); }
  get host() { return this.members.find(m => m.isHost); }
  touch() { this.lastActivity = Date.now(); }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), 60000);
  }
  createRoom(hostId, hostNickname, hostAvatar, hostOpenid) {
    const room = new Room(hostId, hostNickname, hostAvatar, hostOpenid);
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
