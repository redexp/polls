import {URL} from "url";
import {resolve} from "path";
import Client from "@libsql/knex-libsql";

const url = new URL(import.meta.url);
url.pathname = resolve(url.pathname, '..', process.env.DB_PATH || 'database.sqlite');

export default {
  client: Client,
  connection: {
    filename: url.toString()
  },
  useNullAsDefault: true,
};
