'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'tickets',
        {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          code: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true,
          },
          date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          supplier_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'suppliers', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          land_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'lands', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW'),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW'),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex('tickets', ['date'], { transaction });
      await queryInterface.addIndex('tickets', ['supplier_id'], { transaction });
      await queryInterface.addIndex('tickets', ['land_id'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
  },
};
