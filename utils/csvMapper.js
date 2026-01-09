// api/utils/csvMapper.js
function investorMapper(raw) {
  raw = raw || {};

  return {
    firstName: raw["First Name"] || raw.firstName,
    lastName: raw["Last Name"] || raw.lastName,
    email: raw["Email"] || raw.email,
    phone: raw["Phone"] || raw.phone || null,
    jobTitle: raw["Job Title"] || raw.jobTitle,
    seniorityLevel: raw["Seniority Level"] || raw.seniorityLevel || null,
    bio: raw["Bio"] || raw.bio || null,
    avatarUrl: raw["Avatar URL"] || raw.avatarUrl || null,
    linkedinUrl: raw["LinkedIn"] || raw.linkedinUrl || null,
    twitterUrl: raw["Twitter"] || raw.twitterUrl || null,
    personalWebsite: raw["Website"] || raw.personalWebsite || null,
    firmWebsite: raw["Firm Website"] || raw.firmWebsite || null,
    location: raw["Location"] || raw.location || null,
    firmName: raw["Firm Name"] || raw.firmName,
    firmType: raw["Firm Type"] || raw.firmType || null,
    buySellSide: raw["Buy Sell Side"] || raw.buySellSide || null,
    aum: raw["Assets Under Management"] || raw.aum || null,

    investmentStages: raw["Investment Stages"]
      ? String(raw["Investment Stages"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.investmentStages || [],

    sectorPreferences: raw["Sector Preferences"]
      ? String(raw["Sector Preferences"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.sectorPreferences || [],

    geographicPreferences: raw["Geographic Preferences"]
      ? String(raw["Geographic Preferences"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.geographicPreferences || [],

    minCheckSize: raw["Min Check Size"]
      ? Number(String(raw["Min Check Size"]).replace(/,/g, ""))
      : raw.minCheckSize,

    maxCheckSize: raw["Max Check Size"]
      ? Number(String(raw["Max Check Size"]).replace(/,/g, ""))
      : raw.maxCheckSize,

    portfolioCompanies: raw["Portfolio Companies"]
      ? String(raw["Portfolio Companies"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.portfolioCompanies || [],

    notableInvestments: raw["Notable Investments"]
      ? String(raw["Notable Investments"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.notableInvestments || [],

    education: raw.education || [],
    experience: raw["Experience"] || [],
    status: raw.status || "cold",

    tags: raw["Tags"]
      ? String(raw["Tags"])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
      : raw.tags || [],

    notes: raw["Notes"] || raw.notes || null,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
  };
}

// CommonJS export
module.exports = {
  investorMapper: investorMapper,
};
