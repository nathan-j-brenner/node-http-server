
exports.up = function(knex, Promise) {
	return knex.schema.createTable('contacts', function(table){
		table.increments('id');
		table.string('name');
		table.string('email');
		table.integer('age');
	})  
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('contacts');
};
