import { mockUserProfile, mockGapClusters, MOCK_CARDS } from '../mock/mockData';
import type { UserProfile, GapCluster, OpportunityCardView } from '../types/schema';

// This is our frontend API service layer.
// Currently it resolves with mock data, but it forms the exact contract 
// needed for the backend agent to swap in real fetch() calls later.

export const apiClient = {
  /**
   * Uploads a user's resume PDF or portfolio link and returns the parsed profile
   */
  async uploadResume(_file?: File, _link?: string): Promise<UserProfile> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return the mock profile after a simulated 3 second extraction delay
        resolve(mockUserProfile);
      }, 3000);
    });
  },

  /**
   * Fetches the gap clusters for a specific tracked company
   */
  async getGapClusters(_companyName: string): Promise<GapCluster[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockGapClusters);
      }, 1000);
    });
  },

  /**
   * Fetches the matched opportunity cards for the user's dashboard
   */
  async getOpportunityCards(_userId: string): Promise<OpportunityCardView[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_CARDS);
      }, 800);
    });
  }
};
