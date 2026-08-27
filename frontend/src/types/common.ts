/**
 * Types shared by more than one module.
 *
 * Mirrors app/schemas/common.py, and appeared for the same reason it did on
 * the backend: Events and Posts had each declared their own identical creator
 * type, and Blogs would have been the third.
 */

/**
 * The slice of a user the API attaches to anything with an author.
 *
 * Deliberately only these two fields. The endpoints that embed it are public,
 * and the full user shape carries clerk_user_id, role and permissions - which
 * would publish a list of who your officials are and what each of them can do
 * to anyone who loads a page.
 */
export type PublicUser = {
  id: string
  display_name: string
}
