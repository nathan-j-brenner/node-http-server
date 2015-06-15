module.exports = {

  client: 'postgresql',
  connection: {
    database: 'contact_list',
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  }

};