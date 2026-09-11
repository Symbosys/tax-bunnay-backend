import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { goodsWarehouseController } from "../controllers/goods-warehouse.controller";

const goodsWarehouseRouter = Router();

goodsWarehouseRouter.use(protect);

/**
 * @route   GET /api/v1/inventory/goods-warehouse/warehouses
 * @desc    Warehouse locations for the active business
 * @access  Private
 */
goodsWarehouseRouter.get(
  "/warehouses",
  goodsWarehouseController.listWarehouses
);

/**
 * @route   POST /api/v1/inventory/goods-warehouse/warehouses
 * @desc    Create a warehouse / godown location
 * @access  Private
 */
goodsWarehouseRouter.post(
  "/warehouses",
  goodsWarehouseController.createWarehouse
);

/**
 * @route   PATCH /api/v1/inventory/goods-warehouse/warehouses/:id
 * @desc    Update a warehouse / godown location
 * @access  Private
 */
goodsWarehouseRouter.patch(
  "/warehouses/:id",
  goodsWarehouseController.updateWarehouse
);

/**
 * @route   GET /api/v1/inventory/goods-warehouse/products
 * @desc    Products with per-warehouse stock for transfer entry
 * @access  Private
 */
goodsWarehouseRouter.get("/products", goodsWarehouseController.listProducts);

/**
 * @route   GET /api/v1/inventory/goods-warehouse/transfers
 * @desc    Transfer history logs
 * @access  Private
 */
goodsWarehouseRouter.get("/transfers", goodsWarehouseController.listTransfers);

/**
 * @route   POST /api/v1/inventory/goods-warehouse/transfers
 * @desc    Record a confirmed warehouse-to-warehouse stock transfer
 * @access  Private
 */
goodsWarehouseRouter.post(
  "/transfers",
  goodsWarehouseController.createTransfer
);

export { goodsWarehouseRouter };
