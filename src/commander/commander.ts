/*
import { defineProperty, Dict } from 'cosmokit';
import { Context } from '../context';
import yargs, { Arguments, Options } from 'yargs';
import { Bot } from '../bot';

type CommandHandler = (argv: Arguments & Dict<Options>, bot: Bot) => void;

declare module '../context' {
  interface Context {
    $commander: Commander;
    command(
      commandName: string,
      description: string,
      options: Dict<yargs.Options>,
      handler: CommandHandler,
    ): boolean;
  }

  interface Events {}
}

export class Commander {
  static readonly key = '$commander';
  static readonly methods = ['command'];

  _commands: [string, [Context]][];
  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx);
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  command(
    commandName: string,
    description: string,
    options: Dict<yargs.Options>,
    handler: (argv: yargs.Arguments) => void,
  ) {}
}
*/
