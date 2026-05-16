// MongoDB Initialization Script
// 饭局星球 - 数据库初始化

// 1. 切换到数据库
// use fanjuxingqiu

// 2. 创建用户集合
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['openid', 'nickname', 'created_at'],
      properties: {
        openid: { bsonType: 'string', description: '微信openid' },
        nickname: { bsonType: 'string' },
        avatar_url: { bsonType: 'string' },
        preference_tags: { bsonType: 'array', items: { bsonType: 'string' } },
        friend_ids: { bsonType: 'array', items: { bsonType: 'string' } },
        created_at: { bsonType: 'date' }
      }
    }
  }
})

// 3. 创建聚餐记录集合
db.createCollection('gatherings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'date_time', 'location', 'participants', 'total_cost', 'creator_id'],
      properties: {
        title: { bsonType: 'string' },
        date_time: { bsonType: 'date' },
        location: {
          bsonType: 'object',
          properties: {
            name: { bsonType: 'string' },
            lat: { bsonType: 'number' },
            lng: { bsonType: 'number' },
            city: { bsonType: 'string' }
          }
        },
        participants: { bsonType: 'array', items: { bsonType: 'string' } },
        payer: { bsonType: 'string' },
        total_cost: { bsonType: 'number' },
        photos: { bsonType: 'array', items: { bsonType: 'string' } },
        mood_score: { bsonType: 'int', minimum: 1, maximum: 5 },
        mood_tags: { bsonType: 'array', items: { bsonType: 'string' } },
        note: { bsonType: 'string' },
        food_tags: { bsonType: 'array', items: { bsonType: 'string' } },
        creator_id: { bsonType: 'string' },
        created_at: { bsonType: 'date' }
      }
    }
  }
})

// 4. 创建好友关系集合
db.createCollection('relations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_a', 'user_b', 'gather_count'],
      properties: {
        user_a: { bsonType: 'string' },
        user_b: { bsonType: 'string' },
        gather_count: { bsonType: 'int' },
        title: { bsonType: 'string' },
        cities: { bsonType: 'array', items: { bsonType: 'string' } },
        total_spent: { bsonType: 'number' },
        last_gather_at: { bsonType: 'date' }
      }
    }
  }
})

// 5. 创建索引
db.users.createIndex({ openid: 1 }, { unique: true })
db.gatherings.createIndex({ creator_id: 1, date_time: -1 })
db.gatherings.createIndex({ 'location.city': 1 })
db.relations.createIndex({ user_a: 1, user_b: 1 }, { unique: true })

// 6. 插入初始菜系数据（用于转盘）
db.cuisines.insertMany([
  { id: 'chuan', name: '川菜', icon: '🌶️', color: '#D85A30', tags: ['辣', '麻辣', '重口'], enabled: true },
  { id: 'yue', name: '粤菜', icon: '🥟', color: '#1D9E75', tags: ['清淡', '鲜美', '精致'], enabled: true },
  { id: 'ri', name: '日料', icon: '🍣', color: '#534AB7', tags: ['清淡', '生鲜', '精致'], enabled: true },
  { id: 'han', name: '韩餐', icon: '🥘', color: '#185FA5', tags: ['辣', '重口', '烤肉'], enabled: true },
  { id: 'xi', name: '西餐', icon: '🥩', color: '#BA7517', tags: ['精致', '牛排', '浪漫'], enabled: true },
  { id: 'su', name: '素食', icon: '🥗', color: '#1D9E75', tags: ['清淡', '健康', '轻食'], enabled: true }
])

print('饭局星球 数据库初始化完成 ✅')
