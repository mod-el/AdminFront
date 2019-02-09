<style>
	.label {
		width: 50%;
		text-align: right;
		padding-right: 10px;
		padding-bottom: 5px;
		padding-top: 5px;
	}

	.field {
		text-align: left;
		padding-bottom: 5px;
		padding-top: 5px;
	}

	td {
		padding: 5px;
	}
</style>

<h2>Admin Front module install</h2>

<form action="" method="post">
	<?php
	$config = [
		'template' => $config['template'] ?? '',
		'hide-menu' => $config['mobile'] ?? 'mobile',
		'dateFormat' => $config['dateFormat'] ?? 'd/m/Y',
		'priceFormat' => $config['priceFormat'] ?? 'vd',
		'stringaLogin1' => $config['stringaLogin1'] ?? '',
		'stringaLogin2' => $config['stringaLogin2'] ?? '',
	];
	?>
	<hr/>
	<table>
		<tr>
			<td>Template module:</td>
			<td>
				<select name="template">
					<option value=""></option>
					<?php
					$templates = $configClass->searchTemplates();
					foreach ($templates as $t => $t_name) {
						?>
						<option value="<?= entities($t) ?>"<?= $t === $config['template'] ? ' selected' : '' ?>><?= entities($t_name) ?></option><?php
					}
					?>
				</select>
			</td>
			<td>Left menu:</td>
			<td>
				<select name="hide-menu">
					<option value="always"<?= $config['hide-menu'] == 'always' ? ' selected' : '' ?>>Always</option>
					<option value="mobile"<?= $config['hide-menu'] == 'mobile' ? ' selected' : '' ?>>Only mobile</option>
					<option value="never"<?= $config['hide-menu'] == 'never' ? ' selected' : '' ?>>Never</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>Dates format:</td>
			<td><input name="dateFormat" value="<?= entities($config['dateFormat']) ?>"/></td>
			<td>Login phrase 1:</td>
			<td><input name="stringaLogin1" value="<?= entities($config['stringaLogin1']) ?>"/></td>
		</tr>
		<tr>
			<td>Currencies format:</td>
			<td>
				<select name="priceFormat">
					<option value="vd"<?= $config['priceFormat'] == 'vd' ? ' selected' : '' ?>>1.234,00&euro;</option>
					<option value="vp"<?= $config['priceFormat'] == 'vp' ? ' selected' : '' ?>>&euro; 1.234,00</option>
					<option value="pd"<?= $config['priceFormat'] == 'pd' ? ' selected' : '' ?>>1234.00&euro;</option>
					<option value="pp"<?= $config['priceFormat'] == 'pp' ? ' selected' : '' ?>>&euro; 1234.00</option>
				</select>
			</td>
			<td>Login phrase 2:</td>
			<td><input name="stringaLogin2" value="<?= entities($config['stringaLogin2']) ?>"/></td>
		</tr>
	</table>
	<?php
	if (empty($config['url'])) {
		?>
		<hr/>
		<table>
			<tr>
				<td>
					Path<br/> <input type="text" name="path" value="admin"/>
				</td>
				<td>
					Users Table<br/> <input type="text" name="table" value="admin_users"/>
				</td>
			</tr>
			<tr>
				<td class="label"></td>
				<td class="field">
					<input type="checkbox" name="make-users-table" id="utenti" checked/>
					<label for="utenti">Create users table</label>
				</td>
			</tr>

			<tr>
				<td class="label"></td>
				<td class="field">
					<input type="checkbox" name="make-account" id="account" checked/>
					<label for="account">Create first account</label>
				</td>
			</tr>

			<?php
			$defaults = [
				'username' => 'admin',
				'password' => 'admin',
			];
			?>
			<tr>
				<td class="label">Username</td>
				<td class="field">
					<input type="text" name="username" value="<?= $defaults['username'] ?>"/>
				</td>
			</tr>
			<tr>
				<td class="label">Password</td>
				<td class="field">
					<input type="password" name="password" value="<?= $defaults['password'] ?>"/>
				</td>
			</tr>
			<tr>
				<td class="label">Repeat password</td>
				<td class="field">
					<input type="password" name="repassword" value="<?= $defaults['password'] ?>"/>
				</td>
			</tr>
		</table>
		<?php
	}
	?>
	<p style="padding: 10px 0; text-align: center">
		<input type="submit" value="Send"/>
	</p>
</form>