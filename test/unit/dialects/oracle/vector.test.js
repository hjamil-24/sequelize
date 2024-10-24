'use strict';

const util = require('util');
const Support = require('../../support');
const DataTypes = require('sequelize/lib/data-types');
const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;
const Op = Support.Sequelize.Op;

if (current.dialect.name === 'oracle') {
  describe('VECTORS', () => {
    describe('VECTOR datatype', () => {
      const FooUser = current.define('user', {
        vecCol: {
          type: DataTypes.VECTOR,
          allowNull: false
        }
      });

      it('creates table with vector datatype', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          default: 'BEGIN EXECUTE IMMEDIATE \'CREATE TABLE "users" ("id" NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY, "vecCol" VECTOR(*, *) NOT NULL, "createdAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL,PRIMARY KEY ("id"))\'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;' });
      });

    });

    describe('VECTOR datatype with dimension and format', () => {
      const FooUser = current.define('user', {
        vecCol: {
          type: DataTypes.VECTOR(3, 'float32'),
          allowNull: false
        }
      });

      it('creates table with vector datatype', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          default: 'BEGIN EXECUTE IMMEDIATE \'CREATE TABLE "users" ("id" NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY, "vecCol" VECTOR(3, FLOAT32) NOT NULL, "createdAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL,PRIMARY KEY ("id"))\'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;' });
      });

    });

    describe('VECTOR datatype(binary)', () => {
      const FooUser = current.define('user', {
        vecCol: {
          type: DataTypes.VECTOR(16, 'binary'),
          allowNull: false
        }
      });

      it('creates table with vector datatype', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          default: 'BEGIN EXECUTE IMMEDIATE \'CREATE TABLE "users" ("id" NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY, "vecCol" VECTOR(16, BINARY) NOT NULL, "createdAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH LOCAL TIME ZONE NOT NULL,PRIMARY KEY ("id"))\'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;' });
      });

    });

    describe('Vector Index', () => {
      it('default', () => {
        expectsql(sql.addIndexQuery('Foo', ['vec1'], { type: 'VECTOR' }), {
          default: 'CREATE VECTOR INDEX "foo_vec1" ON "Foo" ("vec1") ORAGANIZATION INMEMORY NEIGHBOR GRAPH' });
      });

      it('type and using(hnsw)', () => {
        expectsql(sql.addIndexQuery('foo', ['vec1'], { type: 'VECTOR', using: 'hnsw' }), {
          default: 'CREATE VECTOR INDEX "foo_vec1" ON "foo" ("vec1") ORAGANIZATION INMEMORY NEIGHBOR GRAPH' });
      });

      it('type and using(ivf)', () => {
        expectsql(sql.addIndexQuery('foo', ['vec1'], { type: 'VECTOR', using: 'ivf' }), {
          default: 'CREATE VECTOR INDEX "foo_vec1" ON "foo" ("vec1") ORAGANIZATION NEIGHBOR PARTITION GRAPH' });
      });

      it('hnsw parameter', () => {
        expectsql(sql.addIndexQuery('foo', ['vec1'], { type: 'VECTOR', using: 'hnsw', parameter: { neighbor: 10, efconstruction: 10 } }), {
          default: 'CREATE VECTOR INDEX "foo_vec1" ON "foo" ("vec1") ORAGANIZATION INMEMORY NEIGHBOR GRAPH PARAMETERS (type hnsw, neighbor 10, efconstruction 10)' });
      });

      it('ivf parameter', () => {
        expectsql(sql.addIndexQuery('foo', ['vec1'], { type: 'VECTOR', using: 'ivf', parameter: { partitions: 5, samplesPerPartition: 10, minVectors: 10 } }), {
          default: 'CREATE VECTOR INDEX "foo_vec1" ON "foo" ("vec1") ORAGANIZATION NEIGHBOR PARTITION GRAPH PARAMETERS (type ivf, NEIGHBOR PARTITION 5, SAMPLES_PER_PARTITION 10, MIN_VECORS_PER_PARTITIONS 10)' });
      });
    });

    describe('Vector where clause', () => {
      const val = [1, 2, 3];
    
      const testsql = function(key, value, options, expectation) {
        if (expectation === undefined) {
          expectation = options;
          options = undefined;
        }

        it(`${String(key)}: ${util.inspect(value, { depth: 10 })}${options && `, ${util.inspect(options)}` || ''}`, () => {
          return expectsql(sql.whereItemQuery(key, value, options), expectation);
        });
      };

      testsql(current.literal(`${DataTypes.VECTOR().vectorDistance('embedding', val, current)}`), {
        [Op.lt]: 2
      }, {
        oracle: 'vector_distance("embedding", VECTOR(\'[1,2,3]\', 3)) < 2'
      });
    });

    describe('order by distances', () => {
      const val = [1, 2, 3, 4];
      const testsql = (options, expectation) => {
        const model = options.model;

        it(util.inspect(options, { depth: 2 }), () => {
          return expectsql(
            sql.selectQuery(
              options.table || model && model.getTableName(),
              options,
              options.model
            ),
            expectation
          );
        });
      };

      const User = Support.sequelize.define('User', {
        embedding: {
          type: DataTypes.VECTOR(4)
        }
      }, {
        tableName: 'user'
      });

      testsql({
        model: User,
        attributes: ['embedding'],
        order: [
          current.literal(`${DataTypes.VECTOR().vectorDistance('embedding', val, current)}`)
        ]
      }, {
        oracle: 'SELECT "embedding" FROM "user" "User" ORDER BY vector_distance("embedding", VECTOR(\'[1,2,3,4]\', 4));'
      });
    });
  });
}