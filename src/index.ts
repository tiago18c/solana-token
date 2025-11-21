import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { findAssociatedTokenPda, getMintDecoder, TOKEN_2022_PROGRAM_ADDRESS, getCreateAssociatedTokenInstruction } from "@solana-program/token-2022";
import { Address, appendTransactionMessageInstructions, createTransactionMessage, fetchEncodedAccount, getSignatureFromTransaction, Instruction, isSolanaError, pipe, Rpc, RpcSubscriptions, SendableTransaction, sendAndConfirmTransactionFactory, sendTransactionWithoutConfirmingFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE, SolanaRpcApi, SolanaRpcSubscriptionsApi, Transaction, TransactionSigner, TransactionWithBlockhashLifetime } from "@solana/kit";
import { isTokenAclMintFromMint, createThawPermissionlessInstructionFromMint } from "@token-acl/sdk";

/**
 * Creates the instructions to create an associated token account
 * @param rpc - The RPC client
 * @param payer - The address of the payer
 * @param owner - The address of the owner
 * @param mintAddress - The address of the mint
 * @returns An object containing the instructions and the associated token address
 */
export async function createAssociatedTokenAccountInstructions(
    rpc: Rpc<SolanaRpcApi>,
    payer: TransactionSigner,
    owner: Address,
    mintAddress: Address,
): Promise<{ instructions: Instruction[], associatedTokenAddress: Address }> {

    const mintAccount = await fetchEncodedAccount(rpc, mintAddress, { commitment: 'confirmed' });
    if (!mintAccount.exists || (mintAccount.programAddress != TOKEN_2022_PROGRAM_ADDRESS && mintAccount.programAddress != TOKEN_PROGRAM_ADDRESS)) {
      throw new Error('Provided mintAddress is not a valid token mint');
    }
    const tokenProgram = mintAccount.programAddress;
    
    const [associatedTokenAddress, _] = await findAssociatedTokenPda( {
        mint: mintAddress,
        owner: owner,
        tokenProgram: tokenProgram
    }, { programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS});

    const createAtaInstruction = getCreateAssociatedTokenInstruction({
        ata: associatedTokenAddress,
        mint: mintAddress,
        owner: owner,
        payer: payer,
        tokenProgram: tokenProgram
    }, { programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS});

    if (tokenProgram == TOKEN_PROGRAM_ADDRESS) {
        return { instructions: [createAtaInstruction], associatedTokenAddress: associatedTokenAddress };
    }

    const mint = getMintDecoder().decode(mintAccount.data);

    const isTokenAclMint = await isTokenAclMintFromMint(mint);

    if (!isTokenAclMint) {
        return { instructions: [createAtaInstruction], associatedTokenAddress: associatedTokenAddress };
    }

    const thawInstruction = await createThawPermissionlessInstructionFromMint(rpc, mint, mintAddress, owner, associatedTokenAddress, payer );

    return { instructions: [createAtaInstruction, thawInstruction], associatedTokenAddress: associatedTokenAddress };
}

/**
 * Creates an associated token account without confirming the transaction
 * @param rpc - The RPC client
 * @param payer - The address of the payer
 * @param owner - The address of the owner
 * @param mintAddress - The address of the mint
 * @returns An object containing the signature and the associated token address
 */
export async function createAssociatedTokenAccount(
    rpc: Rpc<SolanaRpcApi>,
    payer: TransactionSigner,
    owner: Address,
    mint: Address,
): Promise<{ signature: string, associatedTokenAddress: Address }> {
    const { instructions, associatedTokenAddress } = await createAssociatedTokenAccountInstructions(rpc, payer, owner, mint);

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
        createTransactionMessage({ version: 0}),
        tx => setTransactionMessageFeePayerSigner(payer, tx),
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        tx => appendTransactionMessageInstructions(instructions, tx)
    );
    
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    const signature = getSignatureFromTransaction(signedTransaction);
    const sendTransaction  = sendTransactionWithoutConfirmingFactory({ rpc });

    try {
        await sendTransaction (signedTransaction, { commitment: 'confirmed' });
    } catch (e) {
        if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
            throw new Error('The transaction failed in simulation', e.cause);
        } else {
            throw e;
        }
    }
    return { signature: signature, associatedTokenAddress: associatedTokenAddress };
}

/**
 * Creates an associated token account and confirms the transaction
 * @param rpc - The RPC client
 * @param rpcSubscriptions - The RPC subscriptions client
 * @param payer - The address of the payer
 * @param owner - The address of the owner
 * @param mintAddress - The address of the mint
 * @returns An object containing the signature and the associated token address
 */
export async function createAndConfirmAssociatedTokenAccount(
    rpc: Rpc<SolanaRpcApi>,
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
    payer: TransactionSigner,
    owner: Address,
    mint: Address,
): Promise<{ signature: string, associatedTokenAddress: Address }> {
    const { instructions, associatedTokenAddress } = await createAssociatedTokenAccountInstructions(rpc, payer, owner, mint);

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
        createTransactionMessage({ version: 0}),
        tx => setTransactionMessageFeePayerSigner(payer, tx),
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        tx => appendTransactionMessageInstructions(instructions, tx), 
    );
    
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    const signature = getSignatureFromTransaction(signedTransaction);
    const sendTransaction  = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

    try {
        await sendTransaction (signedTransaction as SendableTransaction & Transaction & TransactionWithBlockhashLifetime, { commitment: 'confirmed' });
    } catch (e) {
        if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
            throw new Error('The transaction failed in simulation', e.cause);
        } else {
            throw e;
        }
    }
    return { signature: signature, associatedTokenAddress: associatedTokenAddress };
}