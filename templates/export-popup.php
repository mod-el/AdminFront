<fieldset class="pad10" style="width: 450px">
	<form action="?" method="post" onsubmit="exportPopup(2); return false" id="export-form">
		<?php
		switch ($_GET['step']) {
			case 1:
				?>
				<h2>Esportazione</h2>
				<div class="flex-fields">
					<div>
						Formato<br/>
						<select name="format">
							<option value="csv">CSV</option>
						</select>
					</div>
					<div>
						Righe per pagina<br/>
						<input type="number" name="paginate" value="100"/>
					</div>
					<div>
						<br/>
						<input type="submit" value="Genera"/>
					</div>
				</div>
				<?php
				break;
			case 2:
				?>
				<style>
					#export-loading-bar {
						margin-top: 10px;
						height: 30px;
						border: solid #2693FF 1px;
						border-radius: 5px;
					}

					#export-loading-bar > div {
						height: 30px;
						background: #2693FF;
						transition: width 0.4s ease-out;
					}
				</style>

				<h2>Esportazione in corso</h2>
				<div id="export-loading-bar" data-id="<?= $exportId ?>">
					<div style="width: 0%"></div>
				</div>
				<?php
				break;
		}
		?>
	</form>
</fieldset>
