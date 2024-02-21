import { DataTypes, literal } from '@sequelize/core';
import { beforeAll2, expectsql, sequelize, getTestDialect } from '../../support';

const dialect = getTestDialect();

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        firstName: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  // The Oracle dialect doesn't support replacements for bulkInsert
  (dialect !== 'oracle' ? it : it.skip)('parses named replacements in literals', async () => {
    const { User } = vars;

    const sql = queryGenerator.bulkInsertQuery(
      User.table,
      [
        {
          firstName: literal(':injection'),
        },
      ],
      {
        replacements: {
          injection: 'a string',
        },
      },
    );

    expectsql(sql, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('a string');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'a string');`,
      // TODO: ibmi should be the same as `default`, since the 'returning' option is not specified
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('a string'))`,
    });
  });
});
