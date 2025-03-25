'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('describeTable', () => {
    Support.allowDeprecationsInSuite(['SEQUELIZE0015']);

    if (Support.sequelize.dialect.supports.schemas) {
      it('reads the metadata of the table with schema in object', async function () {
        const MyTable1 = this.sequelize.define('my_table', {
          username1: DataTypes.STRING,
        });

        const MyTable2 = this.sequelize.define(
          'my_table',
          {
            username2: DataTypes.STRING,
          },
          { schema: 'test_meta' },
        );

        await this.sequelize.createSchema('test_meta');
        await MyTable1.sync({ force: true });
        await MyTable2.sync({ force: true });
        const metadata0 = await this.queryInterface.describeTable({
          tableName: 'my_tables',
          schema: 'test_meta',
        });
        expect(metadata0.username2).not.to.be.undefined;
        const metadata = await this.queryInterface.describeTable('my_tables');
        expect(metadata.username1).not.to.be.undefined;
      });

      it('reads the metadata of the table with schema parameter', async function () {
        const MyTable1 = this.sequelize.define('my_table', {
          username1: DataTypes.STRING,
        });

        const MyTable2 = this.sequelize.define(
          'my_table',
          {
            username2: DataTypes.STRING,
          },
          { schema: 'test_meta' },
        );

        await this.sequelize.createSchema('test_meta');
        await MyTable1.sync({ force: true });
        await MyTable2.sync({ force: true });
        const metadata0 = await this.queryInterface.describeTable('my_tables', 'test_meta');
        expect(metadata0.username2).not.to.be.undefined;
        const metadata = await this.queryInterface.describeTable('my_tables');
        expect(metadata.username1).not.to.be.undefined;
      });
    }

    it('rejects when no data is available', async function () {
      const table = this.sequelize.queryGenerator.extractTableDetails('_some_random_missing_table');
      await expect(this.queryInterface.describeTable(table)).to.be.rejectedWith(
        `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
      );
    });

    it('reads the metadata of the table', async function () {
      const Users = this.sequelize.define(
        '_Users',
        {
          username: DataTypes.STRING,
          city: {
            type: DataTypes.STRING,
            defaultValue: null,
            comment: 'Users City',
          },
          isAdmin: DataTypes.BOOLEAN,
          enumVals: DataTypes.ENUM('hello', 'world'),
        },
        { freezeTableName: true },
      );

      await Users.sync({ force: true });
      const metadata = await this.queryInterface.describeTable('_Users');
      const id = metadata.id;
      const username = metadata.username;
      const city = metadata.city;
      const isAdmin = metadata.isAdmin;
      const enumVals = metadata.enumVals;

      expect(id.primaryKey).to.be.true;

      if (['mysql', 'mssql', 'db2'].includes(dialect)) {
        expect(id.autoIncrement).to.be.true;
      }

      let assertVal = 'VARCHAR(255)';
      switch (dialect) {
        case 'postgres':
          assertVal = 'CHARACTER VARYING(255)';
          break;
        case 'mssql':
          assertVal = 'NVARCHAR(255)';
          break;
        case 'sqlite3':
          assertVal = 'TEXT';
          break;
        case 'ibmi':
        case 'db2':
          assertVal = 'VARCHAR';
          break;
        case 'oracle':
          assertVal = 'NVARCHAR2';
          break;
      }

      expect(username.type).to.equal(assertVal);
      expect(username.allowNull).to.be.true;

      switch (dialect) {
        case 'sqlite3':
        case 'oracle':
          expect(username.defaultValue).to.be.undefined;
          break;
        default:
          expect(username.defaultValue).to.be.null;
      }

      switch (dialect) {
        case 'sqlite3':
          expect(city.defaultValue).to.be.null;
          break;
      }

      assertVal = 'TINYINT(1)';
      switch (dialect) {
        case 'postgres':
        case 'db2':
          assertVal = 'BOOLEAN';
          break;
        case 'sqlite3':
          assertVal = 'INTEGER';
          break;
        case 'mssql':
          assertVal = 'BIT';
          break;
        case 'ibmi':
          assertVal = 'SMALLINT';
          break;
        case 'oracle':
          assertVal = 'CHAR';
          break;
      }

      expect(isAdmin.type).to.equal(assertVal);
      expect(isAdmin.allowNull).to.be.true;
      switch (dialect) {
        case 'sqlite3':
        case 'oracle':
          expect(isAdmin.defaultValue).to.be.undefined;
          break;
        default:
          expect(isAdmin.defaultValue).to.be.null;
      }

      if (dialect.startsWith('postgres')) {
        expect(enumVals.special).to.be.instanceof(Array);
        expect(enumVals.special).to.have.length(2);
      } else if (dialect === 'mysql') {
        expect(enumVals.type).to.eql("ENUM('hello','world')");
      } else if (dialect === 'oracle') {
        expect(enumVals.type).to.eql('VARCHAR2');
      }

      if (['postgres', 'mysql', 'mssql'].includes(dialect)) {
        expect(city.comment).to.equal('Users City');
        expect(username.comment).to.equal(null);
      }
    });

    it('should correctly determine the primary key columns', async function () {
      const Country = this.sequelize.define(
        '_Country',
        {
          code: { type: DataTypes.STRING, primaryKey: true },
          name: { type: DataTypes.STRING, allowNull: false },
        },
        { freezeTableName: true },
      );
      const Alumni = this.sequelize.define(
        '_Alumni',
        {
          year: { type: DataTypes.INTEGER, primaryKey: true },
          num: { type: DataTypes.INTEGER, primaryKey: true },
          username: { type: DataTypes.STRING, allowNull: false, unique: true },
          dob: { type: DataTypes.DATEONLY, allowNull: false },
          dod: { type: DataTypes.DATEONLY, allowNull: true },
          city: { type: DataTypes.STRING, allowNull: false },
          ctrycod: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: Country, key: 'code' },
          },
        },
        { freezeTableName: true },
      );

      await Country.sync({ force: true });
      const metacountry = await this.queryInterface.describeTable('_Country');
      expect(metacountry.code.primaryKey).to.eql(true);
      expect(metacountry.name.primaryKey).to.eql(false);

      await Alumni.sync({ force: true });
      const metalumni = await this.queryInterface.describeTable('_Alumni');
      expect(metalumni.year.primaryKey).to.eql(true);
      expect(metalumni.num.primaryKey).to.eql(true);
      expect(metalumni.username.primaryKey).to.eql(false);
      expect(metalumni.dob.primaryKey).to.eql(false);
      expect(metalumni.dod.primaryKey).to.eql(false);
      expect(metalumni.ctrycod.primaryKey).to.eql(false);
      expect(metalumni.city.primaryKey).to.eql(false);
    });

    it('should correctly return the columns when the table contains a dot in the name', async function () {
      const User = this.sequelize.define(
        'my.user',
        {
          name: DataTypes.STRING,
        },
        { freezeTableName: true },
      );

      await User.sync({ force: true });
      const metadata = await this.queryInterface.describeTable('my.user');

      expect(metadata).to.haveOwnProperty('name');
    });
  });
});
