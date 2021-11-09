import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import { serialize } from "borsh"
import { PROGRAM_ID } from "../consts"
import * as Layout from "../layouts"
import { getCurrentCycleNumber, getNthCycleStatePubkey } from "../queries/readCycleState"
import { padTo32Bytes } from "../utils/padTo32Bytes"

export async function deleteAuction(
  connection: Connection,
  contractAdmin: Keypair,
  auctionId: string,
  auctionOwnerPubkey: PublicKey,
  num_of_cycles_to_delete: number
): Promise<Transaction> {
  const auctionIdBuffer = padTo32Bytes(auctionId)

  const [contractBankPubkey, _c] = await PublicKey.findProgramAddress(
    [Buffer.from("auction_contract_bank")],
    PROGRAM_ID
  )
  const [auctionPoolPubkey, _b] = await PublicKey.findProgramAddress(
    [Buffer.from("auction_pool"), Buffer.from(contractAdmin.publicKey.toBytes())],
    PROGRAM_ID
  )

  const [auctionBankPubkey, _a] = await PublicKey.findProgramAddress(
    [Buffer.from("auction_bank"), auctionIdBuffer, Buffer.from(auctionOwnerPubkey.toBytes())],
    PROGRAM_ID
  )
  const [auctionRootStatePubkey, _z] = await PublicKey.findProgramAddress(
    [Buffer.from("auction_root_state"), auctionIdBuffer, Buffer.from(auctionOwnerPubkey.toBytes())],
    PROGRAM_ID
  )

  const deleteAuctionArgs = new Layout.DeleteAuctionArgs({
    auctionId: auctionIdBuffer,
    num_of_cycles_to_delete: num_of_cycles_to_delete,
  })

  let auctionData = Buffer.from(serialize(Layout.DELETE_AUCTION_SCHEMA, deleteAuctionArgs))

  let instructionKeys = [
    { pubkey: contractAdmin.publicKey, isSigner: true, isWritable: true },
    { pubkey: contractBankPubkey, isSigner: false, isWritable: false },
    { pubkey: auctionPoolPubkey, isSigner: false, isWritable: true },
    { pubkey: auctionOwnerPubkey, isSigner: false, isWritable: true },
    { pubkey: auctionBankPubkey, isSigner: false, isWritable: true },
    { pubkey: auctionRootStatePubkey, isSigner: false, isWritable: true },
  ]

  const currentCycleNumber = await getCurrentCycleNumber(connection, auctionRootStatePubkey)
  const cycleStatesToInclude = Math.min(currentCycleNumber, num_of_cycles_to_delete)

  for (let i = 0; i < cycleStatesToInclude; ++i) {
    let nthCycleStatePubkey = await getNthCycleStatePubkey(auctionRootStatePubkey, currentCycleNumber - i)
    instructionKeys.push({ pubkey: nthCycleStatePubkey, isSigner: false, isWritable: true })
  }

  const deleteAuctionInstruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    data: auctionData,
    keys: instructionKeys,
  })

  return new Transaction().add(deleteAuctionInstruction)
}