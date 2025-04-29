// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../../support'),
  current = Support.sequelize,
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  semver = require('semver');

if (dialect === 'oracle') {

  describe('vectors', () => {
    before(async function() {
      const version = await current.queryInterface.databaseVersion();
      const supportedVersion = '23.4.0';
      if (semver.gte(version, supportedVersion) === false) {
        this.skip();
      }
    });

    describe('findAll', () => {
      beforeEach(async function() {
        this.Item = this.sequelize.define('Item', {
          embeddings: DataTypes.VECTOR(4)
        });

        await this.Item.sync({ force: true });

        await this.Item.create({ embeddings: new Float32Array([1, 1, 1, 1]) });
        await this.Item.create({ embeddings: new Float32Array([1, 2, 3, 3]) });
      });

      it('fetches the rows from database', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(4) });
        const result = await Item.findAll();
        expect(result.length).to.equal(2);
      });

      it('returns typed array for vector column', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(4) });
        const result = await Item.findAll();
        // typed array property that differentiate it from other buffer view.
        expect(result[0].getDataValue('embeddings').BYTES_PER_ELEMENT).to.equal(4);
      });
    });

    describe('similarity search functions', () => {
      beforeEach(async function() {
        this.Item = this.sequelize.define('Item', {
          embeddings: DataTypes.VECTOR(3)
        });

        await this.Item.sync({ force: true });

        await this.Item.create({ embeddings: new Float32Array([1, 1, 1]) });
        await this.Item.create({ embeddings: new Float32Array([5, 5, 5]) });
        await this.Item.create({ embeddings: new Float32Array([10, 10, 10]) });
        await this.Item.create({ embeddings: new Float32Array([1, 2, 3]) });
      });

      it('l1 distance', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(3) });
        const queryVector = [1, 2, 3];
        const result = await Item.findAll({
          where: current.where(current.fn('L1_DISTANCE', 'embeddings', queryVector), {
            [Op.lt]: 2
          }) 
        });
        expect(result.length).to.equal(1);
      });

      it('l2 distance', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(3) });
        const queryVector = [1, 2, 3];
        const result = await Item.findAll({
          where: current.where(current.fn('L2_DISTANCE', 'embeddings', queryVector), {
            [Op.lt]: 3
          }) 
        });
        expect(result.length).to.equal(2);
      });

      it('inner product', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(3) });
        const queryVector = [1, 2, 3];
        const result = await Item.findAll({
          where: current.where(current.fn('INNER_PRODUCT', 'embeddings', queryVector), {
            [Op.lt]: 3
          }) 
        });
        expect(result.length).to.equal(0);
      });

      it('cosine distance', async function() {
        const Item = this.sequelize.define('Item', { embeddings: Sequelize.VECTOR(3) });
        const queryVector = [1, 2, 3];
        const result = await Item.findAll({
          where: current.where(current.fn('COSINE_DISTANCE', 'embeddings', queryVector), {
            [Op.gt]: 1
          }) 
        });
        expect(result.length).to.equal(0);
      });
    });

  });
}
