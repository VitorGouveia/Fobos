import { Arg, Ctx, Field, Mutation, ObjectType, Resolver } from "type-graphql";
import { AppContext } from "../types";
import { User } from "../entities";
import jwt from "jsonwebtoken";
import { hash, verify } from "argon2";
import {
	createAccessToken,
	createRefreshToken,
	revokeRefreshTokensForUser,
} from "../utils";

@ObjectType()
class FieldError {
	@Field()
	field: string;
	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;

	@Field(() => String, { nullable: true })
	accessToken?: string;
}

@Resolver()
export class UserResolver {
	@Mutation(() => UserResponse)
	async register(
		@Arg("username") username: string,
		@Arg("email") email: string,
		@Arg("password") password: string,
		@Ctx() { orm }: AppContext
	): Promise<UserResponse> {
		// put some validation for the username
		// must be some characters long
		// must not have sexual/violent, explicit in general notation

		// either prefetch the user and see if it exists -> slower
		// or put a try catch on db flush and get the code error for user duplication -> faster
		const hashedPassword = await hash(password);

		const user = orm.create(User, {
			username,
			email,
			password: hashedPassword,
		});

		try {
			await orm.persistAndFlush(user);

			const accessToken = createAccessToken(user);

			return {
				user,
				accessToken,
			};
		} catch (error) {
			// CODE: 23502 -> failed to insert on not null constraint
			switch (error.code) {
				case "23505":
					const key =
						error.constraint === "user_email_unique" ? "email" : "username";
					return {
						errors: [
							{
								field: key,
								message: `${key} already taken.`,
							},
						],
					};

				case "23502":
					return {
						errors: [
							{
								field: "user",
								message: "Failed to insert on not null field",
							},
						],
					};
			}

			return {
				errors: [
					{
						field: "user",
						message: error.message,
					},
				],
			};
		}
	}

	@Mutation(() => UserResponse)
	async login(
		@Arg("username", { nullable: true }) username: string,
		@Arg("email", { nullable: true }) email: string,
		@Arg("password") password: string,
		@Ctx() { orm, res }: AppContext
	): Promise<UserResponse> {
		// search a user by or the email or the username
		const key = !!username ? { username } : { email };
		const user = await orm.findOne(User, key);

		const auth_error = {
			errors: [
				{
					field: "Credentials",
					message: "Invalid login.",
				},
			],
		};

		if (!user) {
			return auth_error;
		}

		const comparePasswords = await verify(user.password, password);

		if (!comparePasswords) {
			return auth_error;
		}

		const refreshToken = createRefreshToken(user);
		const accessToken = createAccessToken(user);

		res.cookie("jid", refreshToken, {
			httpOnly: true,
		});

		// send a refresh and access token back
		return {
			user,
			accessToken,
		};
	}

	@Mutation(() => UserResponse)
	async refreshToken(
		@Ctx() { req, orm, res }: AppContext
	): Promise<UserResponse> {
		console.log(req.cookies);
		const token = req.cookies.jid;

		if (!token) {
			return {
				errors: [
					{
						field: "refresh token",
						message: "No refresh token was supplied.",
					},
				],
			};
		}

		type Payload = {
			userId: string;
			tokenVersion: number;
		};

		let payload: Payload;
		try {
			payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET) as Payload;
		} catch (error) {
			return {
				errors: [
					{
						field: "refresh token",
						message: error.message,
					},
				],
			};
		}

		const user = await orm.findOne(User, {
			id: payload.userId,
		});

		if (!user) {
			return {
				errors: [
					{
						field: "refresh token",
						message: "could not find an user.",
					},
				],
			};
		}

		if (user.tokenVersion !== payload.tokenVersion) {
			return {
				errors: [
					{
						field: "refesh token",
						message: "you token is outdated.",
					},
				],
			};
		}

		const refreshToken = createRefreshToken(user);
		const accessToken = createAccessToken(user);

		res.cookie("jid", refreshToken, {
			httpOnly: true,
		});

		return {
			user,
			accessToken,
		};
	}

	@Mutation(() => Boolean)
	async logout(
		@Arg("id", { nullable: true }) id: string,
		@Ctx() { orm, res }: AppContext
	): Promise<Boolean> {
		if (!id) {
			res.clearCookie("jid");
			return true;
		}

		res.clearCookie("jid");
		revokeRefreshTokensForUser(id, orm);
		// would be good practice to add 1 to user tokenVersion
		// so the user gets logged out of ALL devices, including mobile

		return true;
	}
}
