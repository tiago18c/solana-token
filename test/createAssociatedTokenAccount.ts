import { assertAccountExists, fetchEncodedAccount, generateKeyPairSigner } from '@solana/kit';
import test from 'ava';
import {
  AccountState,
  TOKEN_2022_PROGRAM_ADDRESS,
  Token,
  getTokenDecoder as getTokenDecoder2022
} from '@solana-program/token-2022';
import {
  createDefaultSolanaClient,
  createMint,
  createMint2022,
  createMintAcl,
  generateKeyPairSignerWithSol,
} from './_setup';
import { TOKEN_PROGRAM_ADDRESS, getTokenDecoder } from '@solana-program/token';
import { createAndConfirmAssociatedTokenAccount } from '../src';

test('it creates tokenkeg associated token account', async (t) => {
  t.timeout(30000);
  // Given a mint account and a token account.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const mint = await createMint(client, payer, mintAuthority.address);

  const ata = await createAndConfirmAssociatedTokenAccount(client.rpc, client.rpcSubscriptions, payer, owner.address, mint);


  const account = await fetchEncodedAccount(client.rpc, ata.associatedTokenAddress);
  assertAccountExists(account);
  t.is(account.programAddress, TOKEN_PROGRAM_ADDRESS);

  const tokenAccount = getTokenDecoder().decode(account.data);
  t.like(tokenAccount, <Token>{ amount: 0n, owner: owner.address, mint: mint });
});

test('it creates tokenZ associated token account', async (t) => {
  t.timeout(30000);
  // Given a mint account and a token account.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const mint = await createMint2022({ client, payer, authority: mintAuthority });

  const ata = await createAndConfirmAssociatedTokenAccount(client.rpc, client.rpcSubscriptions, payer, owner.address, mint);


  const account = await fetchEncodedAccount(client.rpc, ata.associatedTokenAddress);
  assertAccountExists(account);
  t.is(account.programAddress, TOKEN_2022_PROGRAM_ADDRESS);

  const tokenAccount = getTokenDecoder2022().decode(account.data);
  t.like(tokenAccount, <Token>{ amount: 0n, owner: owner.address, mint: mint });
});


test('it creates token-acl associated token account', async (t) => {
  t.timeout(30000);
  // Given a mint account and a token account.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
  ]);
  const mint = await createMintAcl(client, payer, mintAuthority);
  
  const ata = await createAndConfirmAssociatedTokenAccount(client.rpc, client.rpcSubscriptions, payer, owner.address, mint);

  const account = await fetchEncodedAccount(client.rpc, ata.associatedTokenAddress);
  assertAccountExists(account);
  t.is(account.programAddress, TOKEN_2022_PROGRAM_ADDRESS);

  const tokenAccount = getTokenDecoder2022().decode(account.data);
  t.like(tokenAccount, <Token>{ amount: 0n, owner: owner.address, mint: mint, state: AccountState.Initialized });
});