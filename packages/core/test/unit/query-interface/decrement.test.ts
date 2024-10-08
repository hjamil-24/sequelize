import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryInterface#decrement', () => {
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

  afterEach(() => {
    sinon.restore();
  });

  // you'll find more replacement tests in query-generator tests
  it('does not parse replacements outside of raw sql', async () => {
    const { User } = vars;
    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.decrement(
      User,
      User.table,
      // where
      { firstName: ':firstName' },
      // incrementAmountsByField
      { age: ':age' },
      // extraAttributesToBeUpdated
      { name: ':name' },
      // options
      {
        returning: [':data'],
        replacements: {
          age: 1,
          id: 2,
          data: 3,
        },
      },
    );

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `UPDATE [Users] SET [age]=[age]- ':age',[name]=':name' WHERE [firstName] = ':firstName'`,
      mssql: `UPDATE [Users] SET [age]=[age]- N':age',[name]=N':name' OUTPUT INSERTED.[:data] WHERE [firstName] = N':firstName'`,
      sqlite3:
        "UPDATE `Users` SET `age`=`age`- ':age',`name`=':name' WHERE `firstName` = ':firstName' RETURNING `:data`",
      postgres: `UPDATE "Users" SET "age"="age"- ':age',"name"=':name' WHERE "firstName" = ':firstName' RETURNING ":data"`,
    });
    expect(firstCall.args[1]?.bind).to.be.undefined;
  });
});
