export const UnifiAsset = { USDT: "USDT", USDC: "USDC", DAI: "DAI" };
export type UnifiAsset = (typeof UnifiAsset)[keyof typeof UnifiAsset];

export const UnifiNetwork = {
  Ethereum: "Ethereum",
  Polygon: "Polygon",
  Sepolia: "Sepolia",
};
export type UnifiNetwork = (typeof UnifiNetwork)[keyof typeof UnifiNetwork];
