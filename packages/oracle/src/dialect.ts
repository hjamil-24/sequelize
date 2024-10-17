// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides';
import { OracleConnectionManager } from './connection-manager';
import type { OracleConnectionOptions, oracledbModule } from './connection-manager.js';
import { OracleQueryGenerator } from './query-generator.js';
import { OracleQueryInterface } from './query-interface.js';
import { OracleQuery } from './query.js';

export interface OracleDialectOptions {
  /**
   *  The oracledb module to user.
   */
  oracledbModule?: oracledbModule;
}

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<OracleConnectionOptions>({
  database: undefined,
  host: undefined,
  oracleOptions: undefined,
  port: undefined,
  accessToken: undefined,
  accessTokenConfig: undefined,
  connectString: undefined,
  connectionString: undefined,
  walletPassword: undefined,
  walletLocation: undefined,
  edition: undefined,
  events: undefined,
  externalAuth: undefined,
  matchAny: undefined,
  newPassword: undefined,
  password: undefined,
  sslAllowWeakDNMatch: undefined,
  httpsProxy: undefined,
  httpsProxyPort: undefined,
  debugJdwp: undefined,
  retryCount: undefined,
  retryDelay: undefined,
  connectTimeout: undefined,
  transportConnectTimeout: undefined,
  expireTime: undefined,
  sdu: undefined,
  connectionIdPrefix: undefined,
  configDir: undefined,
  sourceRoute: undefined,
  sslServerCertDN: undefined,
  sslServerDNMatch: undefined,
  poolAlias: undefined,
  privilege: undefined,
  shardingKey: undefined,
  stmtCacheSize: undefined,
  superShardingKey: undefined,
  tag: undefined,
  user: undefined,
  username: undefined,
});

const numericOptions: SupportableNumericOptions = {
  zerofill: false,
  unsigned: true,
};

export class OracleDialect extends AbstractDialect<OracleDialectOptions, OracleConnectionOptions> {
  static readonly supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: false,
    forShare: 'LOCK IN SHARE MODE',
    index: {
      collate: false,
      length: false,
      parser: false,
      type: false,
      using: false,
    },
    constraints: {
      restrict: false,
      onUpdate: false,
    },
    returnValues: false,
    returnIntoValues: true,
    'ORDER NULLS': true,
    schemas: true,
    inserts: {
      updateOnDuplicate: false,
    },
    indexViaAlter: false,
    dataTypes: {
      COLLATE_BINARY: true,
      GEOMETRY: false,
      JSON: true,
      INTS: numericOptions,
      DOUBLE: numericOptions,
      DECIMAL: { unconstrained: true },
      TIME: {
        precision: false,
      },
    },
    jsonOperations: true,
    jsonExtraction: {
      quoted: true,
    },
    dropTable: {
      cascade: true,
    },
    renameTable: {
      changeSchema: false,
    },
    delete: {
      limit: true,
    },
    startTransaction: {
      useBegin: true,
    },
    upserts: true,
    bulkDefault: true,
    topLevelOrderByRequired: true,
  });

  readonly connectionManager: OracleConnectionManager;
  readonly queryGenerator: OracleQueryGenerator;
  readonly queryInterface: OracleQueryInterface;
  readonly Query = OracleQuery;
  readonly dataTypesDocumentationUrl =
    'https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/Data-Types.html';

  constructor(sequelize: Sequelize, options: OracleDialectOptions) {
    super({
      dataTypesDocumentationUrl:
        'https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/Data-Types.html',
      minimumDatabaseVersion: '18.0.0',
      identifierDelimiter: '"',
      name: 'oracle',
      options,
      sequelize,
      dataTypeOverrides: DataTypes,
    });

    this.connectionManager = new OracleConnectionManager(this);
    // this.connectionManager.initPools();
    this.queryGenerator = new OracleQueryGenerator(this);
    this.queryInterface = new OracleQueryInterface(this);
  }

  parseConnectionUrl(): OracleConnectionOptions {
    throw new Error(
      'The "url" option is not supported by the Db2 dialect. Instead, please use the "odbcOptions" option.',
    );
  }

  getDefaultSchema(): string {
    return this.sequelize.options.replication.write.username?.toUpperCase() ?? '';
  }

  createBindCollector() {
    return createNamedParamBindCollector(':');
  }

  static getDefaultPort(): number {
    return 1521;
  }

  escapeString(val: string): string {
    if (val.startsWith('TO_TIMESTAMP_TZ') || val.startsWith('TO_DATE')) {
      this.assertDate(val);

      return val;
    }

    val = val.replaceAll("'", "''");

    return `'${val}'`;
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `'${hex}'`;
  }

  // assert date to avoid SQL injections.
  assertDate(val: string): void {
    // Split the string using parentheses to isolate the function name, parameters, and potential extra parts
    const splitVal = val.split(/\(|\)/);

    // Validate that the split result has exactly three parts (function name, parameters, and an empty string)
    // and that there are no additional SQL commands after the function call (indicated y the last empty string).
    if (splitVal.length !== 3 || splitVal[2] !== '') {
      throw new Error('Invalid SQL function call.'); // Error if function call has unexpected format
    }

    // Extract the function name (etiher 'TO_TIMESTAM_TZ' or 'TO_DATE') and the contents inside the parantheses
    const functionName = splitVal[0].trim(); // Function name should be 'TO_TIMESTAMP_TZ' or 'TO_DATE'
    const insideParens = splitVal[1].trim(); // This contains the parameters (date value and format string)

    if (!['TO_TIMESTAMP_TZ', 'TO_DATE'].includes(functionName)) {
      throw new Error('Invalid SQL function call. Expected TO_TIMESTAMP_TZ or TO_DATE.');
    }

    // Split the parameters inside the parentheses by commas (should contain exactly two: date and format)
    const params = insideParens.split(',');

    // Validate that the parameters contain exactly two parts (date value and format string)
    if (params.length !== 2) {
      throw new Error(
        'Unexpected input received.\nSequelize supports TO_TIMESTAMP_TZ or TO_DATE exclusively with a combination of value and format.',
      );
    }

    // Extract the format value (second parameter) and remove single quotes around it
    const formatValue = params[1].trim();

    if (functionName === 'TO_TIMESTAMP_TZ') {
      const expectedFormat = "'YYYY-MM-DD HH24:MI:SS.FFTZH:TZM'";
      // Validate that the formatValue is equal to expectedFormat since that is the only format used within sequelize
      if (formatValue !== expectedFormat) {
        throw new Error(
          `Invalid format string for TO_TIMESTAMP_TZ. Expected format: ${expectedFormat}`,
        );
      }
    } else if (functionName === 'TO_DATE') {
      const expectedFormat = "'YYYY/MM/DD'";
      // Validate that the formatValue is equal to expectedFormat since that is the only format used within sequelize
      if (formatValue !== expectedFormat) {
        throw new Error(`Invalid format string for TO_DATE. Expected format: ${expectedFormat}`);
      }
    }
  }

  static getSupportedOptions() {
    return [];
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
