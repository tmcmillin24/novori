import {
    ClubGenreKey,
} from '../constants/club-genres';
import { supabase } from './supabase';

export type ClubPrivacy =
  | 'public'
  | 'private';

export type ClubRole =
  | 'owner'
  | 'admin'
  | 'member';

export type Club = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  privacy: ClubPrivacy;
  genres: ClubGenreKey[];
  cover_url: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type ClubMembership = {
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
};

export type ClubWithMembership =
  Club & {
    membership_role:
      ClubRole | null;
  };

export type ClubMember = {
  user_id: string;
  role: ClubRole;
  joined_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ClubCoverUpload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

async function getCurrentUserId() {
  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error(
      'You must be signed in to use Clubs.'
    );
  }

  return user.id;
}

export async function createClub(input: {
  name: string;
  description: string;
  privacy: ClubPrivacy;
  genres?: ClubGenreKey[];
}) {
  const userId =
    await getCurrentUserId();

  const name =
    input.name.trim();

  const description =
    input.description.trim();

  const genres =
    Array.from(
      new Set(
        input.genres ??
        []
      )
    ).slice(
      0,
      3
    );

  if (
    name.length < 3 ||
    name.length > 60
  ) {
    throw new Error(
      'Club names must be between 3 and 60 characters.'
    );
  }

  if (
    description.length >
    1000
  ) {
    throw new Error(
      'Club descriptions cannot exceed 1,000 characters.'
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('clubs')
      .insert({
        owner_id:
          userId,
        name,
        description,
        privacy:
          input.privacy,
        genres,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data as Club;
}

export async function updateClubGenres(
  clubId: string,
  genres:
    ClubGenreKey[]
): Promise<Club> {
  const userId =
    await getCurrentUserId();

  const normalizedGenres =
    Array.from(
      new Set(
        genres
      )
    ).slice(
      0,
      3
    );

  const {
    data,
    error,
  } =
    await supabase
      .from('clubs')
      .update({
        genres:
          normalizedGenres,
      })
      .eq(
        'id',
        clubId
      )
      .eq(
        'owner_id',
        userId
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data as Club;
}

export async function uploadClubCover(
  clubId: string,
  photo: ClubCoverUpload
) {
  const userId =
    await getCurrentUserId();

  const response =
    await fetch(
      photo.uri
    );

  if (!response.ok) {
    throw new Error(
      'Could not read the selected club photo.'
    );
  }

  const blob =
    await response.blob();

  const rawExtension =
    photo.fileName
      ?.split('.')
      .pop()
      ?.toLowerCase() ||
    photo.mimeType
      ?.split('/')
      .pop()
      ?.toLowerCase() ||
    'jpg';

  const extension =
    rawExtension.replace(
      /[^a-z0-9]/g,
      ''
    ) || 'jpg';

  const filePath =
    `${userId}/${clubId}/cover.${extension}`;

  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        'club-covers'
      )
      .upload(
        filePath,
        blob,
        {
          contentType:
            photo.mimeType ??
            'image/jpeg',
          upsert:
            true,
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data:
      publicUrlData,
  } =
    supabase.storage
      .from(
        'club-covers'
      )
      .getPublicUrl(
        filePath
      );

  const publicUrl =
    `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const {
    data:
      updatedClub,
    error:
      updateError,
  } =
    await supabase
      .from('clubs')
      .update({
        cover_url:
          publicUrl,
      })
      .eq(
        'id',
        clubId
      )
      .eq(
        'owner_id',
        userId
      )
      .select('*')
      .single();

  if (updateError) {
    throw updateError;
  }

  return updatedClub as Club;
}

export async function getMyClubs():
Promise<ClubWithMembership[]> {
  const userId =
    await getCurrentUserId();

  const {
    data:
      membershipRows,
    error:
      membershipError,
  } =
    await supabase
      .from(
        'club_members'
      )
      .select(
        'club_id, user_id, role, joined_at'
      )
      .eq(
        'user_id',
        userId
      )
      .order(
        'joined_at',
        {
          ascending: false,
        }
      );

  if (
    membershipError
  ) {
    throw membershipError;
  }

  const memberships =
    (membershipRows ??
      []) as
      ClubMembership[];

  if (
    memberships.length ===
    0
  ) {
    return [];
  }

  const clubIds =
    memberships.map(
      (
        membership
      ) =>
        membership.club_id
    );

  const {
    data:
      clubRows,
    error:
      clubError,
  } =
    await supabase
      .from('clubs')
      .select('*')
      .in(
        'id',
        clubIds
      );

  if (
    clubError
  ) {
    throw clubError;
  }

  const clubs =
    (clubRows ??
      []) as Club[];

  const clubById =
    new Map(
      clubs.map(
        (club) => [
          club.id,
          club,
        ]
      )
    );

  return memberships
    .map(
      (
        membership
      ) => {
        const club =
          clubById.get(
            membership.club_id
          );

        if (!club) {
          return null;
        }

        return {
          ...club,
          membership_role:
            membership.role,
        };
      }
    )
    .filter(
      (club) =>
        club !== null
    );
}

export async function getDiscoverClubs(
  limit = 50
): Promise<ClubWithMembership[]> {
  const myClubs =
    await getMyClubs();

  const membershipByClubId =
    new Map(
      myClubs.map(
        (club) => [
          club.id,
          club.membership_role,
        ]
      )
    );

  const {
    data,
    error,
  } =
    await supabase
      .from('clubs')
      .select('*')
      .eq(
        'privacy',
        'public'
      )
      .order(
        'member_count',
        {
          ascending: false,
        }
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(limit);

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as
      Club[]
  ).map(
    (club) => ({
      ...club,
      membership_role:
        membershipByClubId.get(
          club.id
        ) ??
        null,
    })
  );
}

export async function searchClubs(
  query: string,
  limit = 30
): Promise<ClubWithMembership[]> {
  const normalized =
    query.trim();

  if (!normalized) {
    return [];
  }

  const myClubs =
    await getMyClubs();

  const membershipByClubId =
    new Map(
      myClubs.map(
        (club) => [
          club.id,
          club.membership_role,
        ]
      )
    );

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        normalized
      );

  const {
    data:
      nameRows,
    error:
      nameError,
  } =
    await supabase
      .from('clubs')
      .select('*')
      .eq(
        'privacy',
        'public'
      )
      .ilike(
        'name',
        `%${normalized}%`
      )
      .order(
        'member_count',
        {
          ascending: false,
        }
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(limit);

  if (nameError) {
    throw nameError;
  }

  const clubsById =
    new Map<
      string,
      Club
    >();

  for (
    const club of
    (
      nameRows ??
      []
    ) as Club[]
  ) {
    clubsById.set(
      club.id,
      club
    );
  }

  if (isUuid) {
    const {
      data:
        idRow,
      error:
        idError,
    } =
      await supabase
        .from('clubs')
        .select('*')
        .eq(
          'id',
          normalized
        )
        .maybeSingle();

    if (idError) {
      throw idError;
    }

    if (idRow) {
      const club =
        idRow as Club;

      clubsById.set(
        club.id,
        club
      );
    }
  }

  return Array.from(
    clubsById.values()
  ).map(
    (club) => ({
      ...club,
      membership_role:
        membershipByClubId.get(
          club.id
        ) ??
        null,
    })
  );
}

export async function getClub(
  clubId: string
): Promise<ClubWithMembership> {
  const userId =
    await getCurrentUserId();

  const {
    data:
      club,
    error:
      clubError,
  } =
    await supabase
      .from('clubs')
      .select('*')
      .eq(
        'id',
        clubId
      )
      .single();

  if (
    clubError
  ) {
    throw clubError;
  }

  const {
    data:
      membership,
    error:
      membershipError,
  } =
    await supabase
      .from(
        'club_members'
      )
      .select(
        'role'
      )
      .eq(
        'club_id',
        clubId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle();

  if (
    membershipError
  ) {
    throw membershipError;
  }

  return {
    ...(club as Club),
    membership_role:
      (
        membership?.role ??
        null
      ) as
        ClubRole | null,
  };
}

export async function joinClub(
  clubId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from(
        'club_members'
      )
      .insert({
        club_id:
          clubId,
        user_id:
          userId,
        role:
          'member',
      });

  if (error) {
    throw error;
  }
}

export async function leaveClub(
  clubId: string
) {
  const userId =
    await getCurrentUserId();

  const {
    error,
  } =
    await supabase
      .from(
        'club_members'
      )
      .delete()
      .eq(
        'club_id',
        clubId
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'role',
        'member'
      );

  if (error) {
    throw error;
  }
}

export async function getClubMembers(
  clubId: string
): Promise<ClubMember[]> {
  const {
    data:
      membershipRows,
    error:
      membershipError,
  } =
    await supabase
      .from(
        'club_members'
      )
      .select(
        'user_id, role, joined_at'
      )
      .eq(
        'club_id',
        clubId
      )
      .order(
        'joined_at',
        {
          ascending: true,
        }
      );

  if (
    membershipError
  ) {
    throw membershipError;
  }

  const memberships =
    (membershipRows ??
      []) as
      ClubMembership[];

  if (
    memberships.length ===
    0
  ) {
    return [];
  }

  const userIds =
    memberships.map(
      (
        membership
      ) =>
        membership.user_id
    );

  const {
    data:
      profileRows,
    error:
      profileError,
  } =
    await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url'
      )
      .in(
        'id',
        userIds
      );

  if (
    profileError
  ) {
    throw profileError;
  }

  const profiles =
    new Map(
      (
        profileRows ??
        []
      ).map(
        (profile) => [
          profile.id,
          profile,
        ]
      )
    );

  return memberships.map(
    (
      membership
    ) => {
      const profile =
        profiles.get(
          membership.user_id
        );

      return {
        user_id:
          membership.user_id,
        role:
          membership.role,
        joined_at:
          membership.joined_at,
        username:
          profile?.username ??
          null,
        display_name:
          profile?.display_name ??
          null,
        avatar_url:
          profile?.avatar_url ??
          null,
      };
    }
  );
}
