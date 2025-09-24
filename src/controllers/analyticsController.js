const prisma = require('../services/db');
const web3Service = require('../services/web3Service');

// GET /api/blockchain/visualization
exports.getBlockchainVisualization = async (req, res, next) => {
	try {
		const containers = await prisma.container.findMany({
			orderBy: { blockNumber: 'asc' }
		});

		const transactions = await prisma.transaction.findMany({
			orderBy: { blockNumber: 'asc' }
		});

		const blockchainData = {
			totalBlocks: containers.length,
			totalTransactions: transactions.length,
			totalGrams: containers.reduce((sum, c) => sum + (c.grams || 0), 0),
			totalTokens: containers.reduce((sum, c) => sum + (c.tokens || 0), 0),
			blocks: containers.map((container) => ({
				blockNumber: container.blockNumber,
				blockHash: container.id,
				timestamp: container.createdAt,
				container: {
					tagId: container.tagId,
					rfid: container.rfid,
					grams: container.grams,
					tokens: container.tokens,
					owner: null
				},
				transactions: transactions
					.filter((tx) => tx.fromTagId === container.tagId || tx.toTagId === container.tagId)
					.map((tx) => ({
						transactionHash: tx.transactionHash,
						type: tx.fromTagId === container.tagId ? 'OUTGOING' : 'INCOMING',
						tokens: tx.tokens,
						from: tx.fromTagId,
						to: tx.toTagId,
						timestamp: tx.timestamp
					}))
			})),
			connections: transactions
				.map((tx) => ({
					fromBlock: containers.find((c) => c.tagId === tx.fromTagId)?.blockNumber,
					toBlock: containers.find((c) => c.tagId === tx.toTagId)?.blockNumber,
					tokens: tx.tokens,
					transactionHash: tx.transactionHash
				}))
				.filter((conn) => conn.fromBlock !== undefined && conn.toBlock !== undefined)
		};

		return res.json({ success: true, data: blockchainData });
	} catch (error) {
		return next(error);
	}
};

// GET /api/blocks
exports.getBlocks = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const totalBlocks = await prisma.container.count();
		const blocks = await prisma.container.findMany({
			orderBy: { blockNumber: 'desc' },
			skip,
			take: limit
		});

		const blocksWithDetails = await Promise.all(
			blocks.map(async (block) => {
				const transactionCount = await prisma.transaction.count({
					where: {
						OR: [{ fromTagId: block.tagId }, { toTagId: block.tagId }]
					}
				});
				return {
					...block,
					transactionCount,
					isGenesis: block.blockNumber === 0
				};
			})
		);

		return res.json({
			success: true,
			data: {
				blocks: blocksWithDetails,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(totalBlocks / limit),
					totalBlocks,
					hasNext: page < Math.ceil(totalBlocks / limit),
					hasPrev: page > 1
				}
			}
		});
	} catch (error) {
		return next(error);
	}
};

// GET /api/dashboard/stats
exports.getDashboardStats = async (req, res, next) => {
	try {
		const [totalBlocks, totalTransactions, totalGroups] = await Promise.all([
			prisma.container.count(),
			prisma.transaction.count(),
			prisma.group.count()
		]);

		const totals = await prisma.container.aggregate({
			_sum: { grams: true, tokens: true }
		});
		const totalGrams = totals._sum.grams || 0;
		const totalTokens = totals._sum.tokens || 0;

		const recentTransactions = await prisma.transaction.findMany({
			orderBy: { timestamp: 'desc' },
			take: 5,
			include: { fromContainer: true, toContainer: true }
		});

		const largestContainers = await prisma.container.findMany({
			orderBy: { tokens: 'desc' },
			take: 5
		});

		// Daily volume for last 7 days (SQL Server)
		const dailyVolume = await prisma.$queryRaw`
			SELECT
				CONVERT(date, [timestamp]) AS day,
				SUM([tokens]) AS totalTokens,
				COUNT(*) AS transactionCount
			FROM [Transaction]
			WHERE [timestamp] >= DATEADD(day, -7, GETDATE())
			GROUP BY CONVERT(date, [timestamp])
			ORDER BY day ASC
		`;

		const systemHealth = await checkBlockchainConnection();

		return res.json({
			success: true,
			data: {
				overview: {
					totalBlocks,
					totalTransactions,
					totalGroups,
					totalGrams: Math.round(totalGrams * 100) / 100,
					totalTokens: Math.round(totalTokens * 100) / 100,
					averageTokensPerBlock: totalBlocks > 0 ? Math.round((totalTokens / totalBlocks) * 100) / 100 : 0
				},
				recentActivity: recentTransactions,
				largestContainers: largestContainers.map((c) => ({
					tagId: c.tagId,
					tokens: c.tokens,
					grams: c.grams,
					blockNumber: c.blockNumber
				})),
				dailyVolume: dailyVolume.map((row) => ({
					date: row.day,
					totalTokens: Number(row.totalTokens),
					transactionCount: Number(row.transactionCount)
				})),
				systemHealth: {
					database: true,
					blockchain: systemHealth,
					lastSync: new Date().toISOString()
				}
			}
		});
	} catch (error) {
		return next(error);
	}
};

async function checkBlockchainConnection() {
	try {
		const blockNumber = await web3Service.web3.eth.getBlockNumber();
		let network = null;
		try {
			const chainId = await web3Service.web3.eth.getChainId();
			network = `chainId:${chainId}`;
		} catch (e) {
			network = 'unknown';
		}
		return { connected: true, blockNumber: Number(blockNumber), network };
	} catch (error) {
		return { connected: false, error: error.message };
	}
}


