'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'ticket_details',
        {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          ticket_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'tickets', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          line_number: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          product_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'products', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          price: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
          },
          total: {
            type: 'NUMERIC(14,3) GENERATED ALWAYS AS (quantity * price) STORED',
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

      await queryInterface.addConstraint('ticket_details', {
        type: 'unique',
        fields: ['ticket_id', 'line_number'],
        name: 'ticket_details_ticket_line_unique',
        transaction,
      });

      await queryInterface.addConstraint('ticket_details', {
        type: 'check',
        fields: ['line_number'],
        where: { line_number: { [Op.gt]: 0 } },
        name: 'ticket_details_line_number_check',
        transaction,
      });

      await queryInterface.addConstraint('ticket_details', {
        type: 'check',
        fields: ['quantity'],
        where: { quantity: { [Op.gte]: 0 } },
        name: 'ticket_details_quantity_check',
        transaction,
      });

      await queryInterface.addConstraint('ticket_details', {
        type: 'check',
        fields: ['price'],
        where: { price: { [Op.gt]: 0 } },
        name: 'ticket_details_price_check',
        transaction,
      });

      await queryInterface.addIndex('ticket_details', ['product_id'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_details');
  },
};
