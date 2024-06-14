import fs from 'fs'
import { parse } from 'csv-parse'
import 'dotenv/config'
import { Contract } from 'ethers'
import path from 'path'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

interface Abi {
  address: string
  abi: any[]
}

interface Domain {
  domain: string
  owner: string
}

enum DomainStatuses {
  Failed = 'Failed',
  Success = 'Success',
  NotStarted = 'NotStarted',
}

interface TrackingData {
  domain: string
  owner: string
  status: DomainStatuses
  error?: unknown
}

const loadAbi = (path: string): Abi => {
  try {
    return require(path)
  } catch (error) {
    console.error(`Failed to load ABI from ${path}:`, error)
    process.exit(1)
  }
}

const PROGRESS_FILE = path.resolve(__dirname, './progress.json')

function createTrackingFile(filePath: string): Map<string, TrackingData> {
  if (fs.existsSync(filePath)) {
    const mapAsArray = fs.readFileSync(filePath, 'utf-8')
    return new Map(JSON.parse(mapAsArray))
  }

  fs.writeFileSync(
    filePath,
    JSON.stringify(Array.from(new Map<string, TrackingData>().entries())),
  )
  return new Map<string, TrackingData>()
}

function updateTrackingFile(trackingData: Map<string, TrackingData>) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify(Array.from(trackingData.entries()), null, 2),
  )
}

async function main(hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name

  let registrarControllerAbi: Abi
  let resolverAbi: Abi
  let rpcUrl: string

  switch (network) {
    case 'lineaSepolia':
      registrarControllerAbi = loadAbi(
        '../deployments/LineaSepolia/ETHRegistrarController.json',
      )
      resolverAbi = loadAbi('../deployments/LineaSepolia/PublicResolver.json')
      rpcUrl = `https://linea-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
      break
    case 'mainnet':
      registrarControllerAbi = loadAbi(
        '../deployments/mainnet/ETHRegistrarController.json',
      )
      resolverAbi = loadAbi('../deployments/mainnet/PublicResolver.json')
      rpcUrl = `https://linea-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
      break
    default:
      registrarControllerAbi = loadAbi(
        '../deployments/localhost/ETHRegistrarController.json',
      )
      resolverAbi = loadAbi('../deployments/localhost/PublicResolver.json')
      rpcUrl = 'http://localhost:8545'
      break
  }

  const validateEnv = (key: string): string => {
    const value = process.env[key]
    if (!value) {
      console.error(`Environment variable ${key} is not set.`)
      process.exit(1)
    }
    return value
  }

  const registrarControllerAddress = registrarControllerAbi.address
  const resolverAddress = resolverAbi.address

  const CSV_FILE_PATH = path.resolve(__dirname, './domains.csv')
  const DURATION = 365 * 99 * 24 * 60 * 60 // 99 years in seconds
  const OWNER_CONTROLLED_FUSES = 0 // Fuses, 0 for no restrictions
  const REVERSE_RECORD = true

  async function getSigner() {
    if (network === 'localhost') {
      const signers = await hre.ethers.getSigners()
      return {
        deployer: signers[0], // Account 0
        owner: signers[1], // Account 1
      }
    } else {
      const provider = new hre.ethers.providers.JsonRpcProvider(rpcUrl)
      return {
        deployer: new hre.ethers.Wallet(
          validateEnv('DEPLOYER_PRIVATE_KEY'),
          provider,
        ),
        owner: new hre.ethers.Wallet(
          validateEnv('OWNER_PRIVATE_KEY'),
          provider,
        ),
      }
    }
  }

  async function registerDomain(
    domainName: string,
    ownerAddress: string,
    registrarController: Contract,
    resolver: Contract,
  ) {
    const fullDomainName = `${domainName}.${process.env.BASE_DOMAIN}.eth`
    const namehash = hre.ethers.utils.namehash(fullDomainName)

    const data = [
      resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
        namehash,
        ownerAddress,
      ]),
    ]

    console.log(`Data for ${domainName}:`, data)

    try {
      const estimatedGasLimit =
        await registrarController.estimateGas.ownerRegister(
          domainName,
          ownerAddress,
          DURATION,
          resolver.address,
          data,
          OWNER_CONTROLLED_FUSES,
          REVERSE_RECORD,
        )

      console.log(
        `Estimated gas limit for ${domainName}: ${estimatedGasLimit.toString()}`,
      )

      const tx = await registrarController.ownerRegister(
        domainName,
        ownerAddress,
        DURATION,
        resolver.address,
        data,
        OWNER_CONTROLLED_FUSES,
        REVERSE_RECORD,
        { gasLimit: estimatedGasLimit },
      )
      await tx.wait()
      console.log(`Domain ${domainName} registered successfully.`)
      return DomainStatuses.Success
    } catch (error: any) {
      console.error(`Failed to register domain ${domainName}:`, error)
      if (error?.error?.data) {
        const revertReason = hre.ethers.utils.toUtf8String(
          '0x' + error.error.data.substr(138),
        )
        console.error('Revert reason:', revertReason)
      }
      return DomainStatuses.Failed
    }
  }

  const { deployer, owner } = await getSigner()

  const registrarController = new Contract(
    registrarControllerAddress,
    registrarControllerAbi.abi,
    owner,
  )
  const resolver = new Contract(resolverAddress, resolverAbi.abi, deployer)

  console.log(`RegistrarController owner: ${await registrarController.owner()}`)

  // Load tracking data or start fresh
  const trackingData = createTrackingFile(PROGRESS_FILE)

  // Parse CSV file if starting fresh or if there are new entries
  const domains: Domain[] = []
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(parse({ columns: true }))
    .on('data', (row) => {
      domains.push({ domain: row.domain, owner: row.owner })
    })
    .on('end', async () => {
      console.log('CSV file successfully processed')
      let newDomainsAdded = false
      for (const { domain, owner } of domains) {
        if (!trackingData.has(domain)) {
          trackingData.set(domain, {
            domain,
            owner,
            status: DomainStatuses.NotStarted,
          })
          newDomainsAdded = true
        }
      }
      if (newDomainsAdded) {
        updateTrackingFile(trackingData)
      }
      await processDomains(trackingData)
    })

  async function processDomains(trackingData: Map<string, TrackingData>) {
    for (const [domain, data] of trackingData.entries()) {
      if (data.status === DomainStatuses.NotStarted || data.status === DomainStatuses.Failed) {
        console.log(`Processing domain: ${domain}, owner: ${data.owner}`)
        const status = await registerDomain(
          domain,
          data.owner,
          registrarController,
          resolver,
        )
        trackingData.set(domain, { ...data, status })
        updateTrackingFile(trackingData)
      }
    }
    console.log('All domains processed.')
  }
}

main(require('hardhat') as HardhatRuntimeEnvironment).catch(console.error)
