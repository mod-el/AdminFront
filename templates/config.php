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

<h2>Admin Front settings</h2>

<form action="" method="post" name="configForm">
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
			<td>Login phrase:</td>
			<td><input name="stringaLogin" value="<?= entities($config['stringaLogin']) ?>"/></td>
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
			<td colspan="2">
				<input type="checkbox" name="enableHistoryNavigation" id="enableHistoryNavigation"<?= $config['enableHistoryNavigation'] ? ' checked' : '' ?>/>
				<label for="enableHistoryNavigation">Enable history navigation</label>
			</td>
		</tr>
	</table>

	<p>
		<input type="submit" value="Save"/>
	</p>
</form>
